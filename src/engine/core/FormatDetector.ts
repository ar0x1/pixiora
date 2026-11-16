import type { FileDescriptor, ImportedFormat } from '@/types/image';
import { EngineError } from '@/engine/core/EngineTypes';

/**
 * Signature-first format detection.
 *
 * Rule from the spec: never trust the filename extension. We read magic bytes
 * for every binary container we support, then fall back to MIME + extension,
 * then to a text probe for SVG (which is XML, not a magic-number format).
 *
 * This module is pure and synchronous so it can be unit-tested without a DOM.
 */

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));

const startsWithBytes = (bytes: Uint8Array, sig: readonly number[], offset = 0): boolean => {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
};

interface FormatSpec {
  readonly format: ImportedFormat;
  readonly mimeType: string;
  readonly extension: string;
}

const SPECS: Record<ImportedFormat, FormatSpec> = {
  jpeg: { format: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg' },
  png: { format: 'png', mimeType: 'image/png', extension: 'png' },
  webp: { format: 'webp', mimeType: 'image/webp', extension: 'webp' },
  avif: { format: 'avif', mimeType: 'image/avif', extension: 'avif' },
  gif: { format: 'gif', mimeType: 'image/gif', extension: 'gif' },
  svg: { format: 'svg', mimeType: 'image/svg+xml', extension: 'svg' },
  heic: { format: 'heic', mimeType: 'image/heic', extension: 'heic' },
  tiff: { format: 'tiff', mimeType: 'image/tiff', extension: 'tiff' },
};

export const formatSpec = (format: ImportedFormat, detectedBy: FileDescriptor['detectedBy'], sizeBytes: number): FileDescriptor => ({
  ...SPECS[format],
  sizeBytes,
  detectedBy,
});

/** ISO-BMFF brand at bytes 8..12 decides AVIF vs HEIC vs OTHER. */
const detectIsoBmff = (bytes: Uint8Array): 'avif' | 'heic' | null => {
  if (!startsWithBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return null; // 'ftyp'
  const brand = ascii(bytes, 8, 12);
  if (brand === 'avif' || brand === 'avis') return 'avif';
  if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return 'heic';
  return null;
};

const looksLikeSvg = (bytes: Uint8Array): boolean => {
  // Inspect the first 2 KB as UTF-8 text; allow BOM, XML prolog, comments, doctype.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 2048)).replace(/^\uFEFF/, '');
  const body = head.trimStart();
  if (!body.startsWith('<')) return false;
  if (/^<\?xml/i.test(body) || /^<!--/.test(body) || /^<!doctype/i.test(body)) {
    return /<svg[\s>]/i.test(head);
  }
  return /^<svg[\s>]/i.test(body);
};

/**
 * Sniff a format from the first bytes of a file.
 * Throws EngineError('INVALID_SIGNATURE' | 'UNSUPPORTED_FORMAT') when nothing matches.
 */
export const detectFormatFromBytes = (bytes: Uint8Array): ImportedFormat => {
  if (bytes.length < 4) {
    throw new EngineError('INVALID_SIGNATURE', 'File is too small to be a valid image (less than 4 bytes).');
  }

  // JPEG: FF D8 FF
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

  // RIFF....WEBP
  if (startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 12) === 'WEBP') return 'webp';

  // TIFF: II*\0 (little endian) or MM\0* (big endian) — also BigTIFF II+\0
  if (startsWithBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return 'tiff';
  }
  if (startsWithBytes(bytes, [0x49, 0x49, 0x2b, 0x00]) || startsWithBytes(bytes, [0x4d, 0x4d, 0x00, 0x2b])) {
    throw new EngineError('UNSUPPORTED_FORMAT', 'BigTIFF files are not supported. Please export a standard TIFF.');
  }

  // GIF87a / GIF89a
  if (startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';

  const iso = detectIsoBmff(bytes);
  if (iso) return iso;

  if (looksLikeSvg(bytes)) return 'svg';

  throw new EngineError(
    'UNSUPPORTED_FORMAT',
    'Unrecognised file signature. PIXIORA supports JPEG, PNG, WebP, AVIF, GIF, SVG, HEIC and TIFF.',
    `First bytes: ${Array.from(bytes.subarray(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')}`,
  );
};

/** Read at most `limit` bytes from the head of a File without loading all of it. */
export const readHead = async (file: Blob, limit = 4096): Promise<Uint8Array> => {
  const slice = file.slice(0, Math.min(limit, file.size));
  return new Uint8Array(await slice.arrayBuffer());
};

/**
 * Full detection for an uploaded file: signature first, then MIME/extension,
 * then a text probe. Everything else is rejected — we never guess wildly.
 */
export const detectFileFormat = async (file: File): Promise<FileDescriptor> => {
  const head = await readHead(file);

  try {
    const format = detectFormatFromBytes(head);
    return formatSpec(format, 'signature', file.size);
  } catch (signatureError) {
    const mime = (file.type || '').toLowerCase();
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();

    const mimeMap: Record<string, ImportedFormat> = {
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpeg',
      'image/pjpeg': 'jpeg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'image/heic': 'heic',
      'image/heif': 'heic',
      'image/tiff': 'tiff',
    };
    const extMap: Record<string, ImportedFormat> = {
      jpg: 'jpeg', jpeg: 'jpeg', jpe: 'jpeg', png: 'png', webp: 'webp', avif: 'avif',
      gif: 'gif', svg: 'svg', heic: 'heic', heif: 'heic', tif: 'tiff', tiff: 'tiff',
    };

    const byMime = mimeMap[mime];
    const byExt = extMap[ext];
    const agreed = byMime !== undefined && byExt !== undefined && byMime === byExt;
    const tentative = byMime ?? byExt;

    if (tentative === 'svg' || ext === 'svg' || mime.includes('svg')) {
      // A claimed SVG whose head is not XML still gets rejected below by the parser.
      if (/^\s*</.test(new TextDecoder().decode(head))) {
        return formatSpec('svg', 'text-probe', file.size);
      }
    }
    if (agreed && tentative) return formatSpec(tentative, 'mime+extension', file.size);
    if (tentative) {
      // MIME or extension claims something, but the bytes disagree: refuse.
      throw new EngineError(
        'INVALID_SIGNATURE',
        `This file's contents do not match its ${byMime ? 'declared MIME type' : 'file extension'} (${byMime ?? byExt}). It may be corrupt or mislabelled.`,
      );
    }
    throw EngineError.from(signatureError, 'UNSUPPORTED_FORMAT');
  }
};
