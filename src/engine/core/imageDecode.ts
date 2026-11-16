import type { DecodedImage, ImportedFormat } from '@/types/image';
import { EngineError } from '@/engine/core/EngineTypes';
import { analyseAlpha } from '@/engine/optimization/transparency';
import { applyOrientation, orientationSwapsAxes, readExifOrientation } from '@/engine/optimization/metadata';
import { drawableToImageData } from '@/engine/optimization/canvas';
import { initWasmModule, WASM_URLS } from '@/engine/codecs/wasmModules';
import { detectFormatFromBytes } from '@/engine/core/FormatDetector';

/**
 * Native-browser decoding first, WASM fallback second.
 *
 * Browsers decode PNG/JPEG/WebP/GIF/AVIF in C++ and apply EXIF orientation
 * automatically via `createImageBitmap({ imageOrientation: 'from-image' })`.
 * That is faster and more correct than reimplementing it, so we prefer it.
 * When the browser cannot decode a format (e.g. AVIF in older Safari) we fall
 * back to the matching WASM decoder — and only claim success if that works.
 */

interface BitmapResult {
  readonly data: ImageData;
  readonly width: number;
  readonly height: number;
}

const decodeWithImageBitmap = async (
  buffer: ArrayBuffer,
  mime: string,
): Promise<BitmapResult | null> => {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const blob = new Blob([buffer], { type: mime });
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    try {
      const data = drawableToImageData(bitmap, bitmap.width, bitmap.height);
      return { data, width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
};

const MIME_BY_FORMAT: Record<ImportedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  tiff: 'image/tiff',
};

/** Normalise a raw ImageData result and apply EXIF orientation if not already done. */
const finalise = (
  imageData: ImageData,
  format: ImportedFormat,
  sourceBytes: number,
  orientationAlreadyApplied: boolean,
  rawBuffer?: Uint8Array,
): DecodedImage => {
  let data = imageData;
  if (!orientationAlreadyApplied && rawBuffer && (format === 'jpeg' || format === 'tiff')) {
    const { orientation } = readExifOrientation(rawBuffer);
    if (orientation !== 1) {
      data = applyOrientation(data, orientation);
    }
  }
  const alpha = analyseAlpha(data.data);
  return {
    imageData: data,
    width: data.width,
    height: data.height,
    hasAlpha: alpha.hasAlpha,
    isAnimated: false,
    sourceFormat: format,
    sourceBytes,
  };
};

/** Browser-native decode for raster formats the engine can hand to `ImageBitmap`. */
export const decodeNative = async (
  buffer: ArrayBuffer,
  format: ImportedFormat,
): Promise<DecodedImage> => {
  const mime = MIME_BY_FORMAT[format];
  const result = await decodeWithImageBitmap(buffer, mime);
  if (result) {
    return finalise(result.data, format, buffer.byteLength, true, new Uint8Array(buffer));
  }

  // Fall back to per-format WASM decoders.
  if (format === 'jpeg') {
    const mod = (await initWasmModule('jpeg-dec', WASM_URLS.jpegDec())) as {
      default?: (b: ArrayBuffer) => Promise<ImageData>;
    } & ((b: ArrayBuffer) => Promise<ImageData>);
    const decode = (mod.default ?? mod) as (b: ArrayBuffer) => Promise<ImageData>;
    const data = await decode(buffer);
    return finalise(data, format, buffer.byteLength, false, new Uint8Array(buffer));
  }
  if (format === 'webp') {
    const mod = (await initWasmModule('webp-dec', WASM_URLS.webpDec())) as {
      default?: (b: ArrayBuffer) => Promise<ImageData>;
    } & ((b: ArrayBuffer) => Promise<ImageData>);
    const decode = (mod.default ?? mod) as (b: ArrayBuffer) => Promise<ImageData>;
    const data = await decode(buffer);
    return finalise(data, format, buffer.byteLength, true);
  }
  if (format === 'avif') {
    const mod = (await initWasmModule('avif-dec', WASM_URLS.avifDec())) as {
      default?: (b: ArrayBuffer) => Promise<ImageData>;
    } & ((b: ArrayBuffer) => Promise<ImageData>);
    const decode = (mod.default ?? mod) as (b: ArrayBuffer) => Promise<ImageData>;
    const data = await decode(buffer);
    return finalise(data, format, buffer.byteLength, true);
  }

  throw new EngineError(
    'DECODER_FAILED',
    `This browser could not decode the ${format.toUpperCase()} image, and no fallback decoder is available for it.`,
  );
};

/** Verify a freshly detected buffer really is the format we expect. */
export const assertSignature = (bytes: Uint8Array, expected: ImportedFormat): void => {
  let actual: ImportedFormat;
  try {
    actual = detectFormatFromBytes(bytes);
  } catch (error) {
    throw EngineError.from(error, 'INVALID_SIGNATURE');
  }
  if (actual !== expected) {
    throw new EngineError(
      'INVALID_SIGNATURE',
      `Expected ${expected.toUpperCase()} bytes but found ${actual.toUpperCase()}.`,
    );
  }
};

export { orientationSwapsAxes };
