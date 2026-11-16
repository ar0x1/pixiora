import { useCallback, useRef, useState } from 'react';
import { useImageStore, type NewImageEntry } from '@/store/imageStore';
import { validateFile } from '@/utils/validateImage';
import { checkDimensions } from '@/engine/core/limits';
import type { ImportedFormat } from '@/types/image';

/**
 * Upload ingestion.
 *
 * For each file we: validate the signature → read bytes once → determine
 * intrinsic dimensions (cheap header read where possible, `createImageBitmap`
 * otherwise) → commit to the store. Validation failures are returned as data so
 * the UI can list them without an error boundary.
 */

export interface RejectedFile {
  readonly name: string;
  readonly code: string;
  readonly message: string;
}

export interface UploadState {
  readonly busy: boolean;
  readonly rejected: readonly RejectedFile[];
  readonly accept: (files: FileList | readonly File[]) => Promise<void>;
  readonly clearRejected: () => void;
}

/**
 * Read dimensions without fully decoding where possible.
 * JPEG/PNG/WebP/GIF/AVIF expose size in headers; SVG in markup. Everything else
 * falls back to `createImageBitmap`, which we always close to free memory.
 */
export const readDimensions = async (
  fileBytes: ArrayBuffer,
  format: ImportedFormat,
  mime: string,
): Promise<{ width: number; height: number }> => {
  const view = new DataView(fileBytes);
  const bytes = new Uint8Array(fileBytes);

  try {
    if (format === 'png' && bytes.length > 24) {
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (format === 'gif' && bytes.length > 10) {
      return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }
    if (format === 'webp' && bytes.length > 30) {
      const chunk = String.fromCharCode(...bytes.subarray(12, 16));
      if (chunk === 'VP8X') {
        const w = 1 + (bytes[24] as number) + ((bytes[25] as number) << 8) + ((bytes[26] as number) << 16);
        const h = 1 + (bytes[27] as number) + ((bytes[28] as number) << 8) + ((bytes[29] as number) << 16);
        return { width: w, height: h };
      }
      if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      if (chunk === 'VP8L') {
        const bits = view.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    if (format === 'jpeg') {
      // Walk markers until a Start-Of-Frame segment yields the real size.
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1] as number;
        const length = view.getUint16(offset + 2);
        const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSof) {
          return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
        }
        offset += 2 + length;
      }
    }
    if (format === 'svg') {
      const text = new TextDecoder().decode(bytes.subarray(0, 2048));
      const w = /\bwidth\s*=\s*["']([\d.]+)/i.exec(text)?.[1];
      const h = /\bheight\s*=\s*["']([\d.]+)/i.exec(text)?.[1];
      const vb = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(text)?.[1]?.trim().split(/[\s,]+/);
      const vw = vb?.[2] ? Number.parseFloat(vb[2]) : undefined;
      const vh = vb?.[3] ? Number.parseFloat(vb[3]) : undefined;
      const width = w ? Number.parseFloat(w) : vw;
      const height = h ? Number.parseFloat(h) : vh;
      if (width && height) return { width: Math.round(width), height: Math.round(height) };
    }
  } catch {
    /* fall through to bitmap decoding */
  }

  // Authoritative fallback: let the browser decode it — but only for formats a
  // browser can actually decode natively. HEIC/TIFF need our WASM decoders, so
  // for those we return 0×0 here and resolve real dimensions during processing
  // instead of failing the upload (a thrown error here used to reject the file).
  const nativelyDecodable = format !== 'svg' && format !== 'heic' && format !== 'tiff';
  if (typeof createImageBitmap === 'function' && nativelyDecodable) {
    try {
      const blob = new Blob([fileBytes], { type: mime });
      const bitmap = await createImageBitmap(blob);
      try {
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    } catch {
      // Header parsing failed and the browser cannot decode it either. The
      // engine will report a precise error when the user processes the file.
      return { width: 0, height: 0 };
    }
  }
  return { width: 0, height: 0 };
};

export const useUpload = (): UploadState => {
  const addImages = useImageStore((state) => state.addImages);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const busyRef = useRef(false);

  const accept = useCallback(
    async (input: FileList | readonly File[]) => {
      if (busyRef.current) return; // ignore re-entrant drops while ingesting
      const files = Array.from(input as ArrayLike<File>);
      if (files.length === 0) return;

      busyRef.current = true;
      setBusy(true);
      const failures: RejectedFile[] = [];
      const accepted: NewImageEntry[] = [];

      for (const file of files) {
        const validation = await validateFile(file);
        if (!validation.ok) {
          failures.push({ name: file.name, code: validation.code, message: validation.message });
          continue;
        }
        try {
          const fileBytes = await file.arrayBuffer();
          const { width, height } = await readDimensions(fileBytes, validation.descriptor.format, validation.descriptor.mimeType);
          const dims = checkDimensions(width || 1, height || 1);
          if (!dims.ok && width > 0 && height > 0) {
            failures.push({ name: file.name, code: dims.code, message: dims.reason });
            continue;
          }
          accepted.push({
            file,
            descriptor: validation.descriptor,
            fileBytes,
            width,
            height,
            // Alpha/animation are determined authoritatively during processing;
            // these defaults make the UI honest until then.
            hasAlpha: validation.descriptor.format === 'png' || validation.descriptor.format === 'webp' || validation.descriptor.format === 'svg' || validation.descriptor.format === 'avif',
            isAnimated: validation.descriptor.format === 'gif',
          });
        } catch (error) {
          failures.push({
            name: file.name,
            code: 'CORRUPT_IMAGE',
            message: error instanceof Error ? error.message : 'Could not read this file.',
          });
        }
      }

      if (accepted.length > 0) addImages(accepted);
      setRejected(failures);
      setBusy(false);
      busyRef.current = false;
    },
    [addImages],
  );

  const clearRejected = useCallback(() => setRejected([]), []);

  return { busy, rejected, accept, clearRejected };
};
