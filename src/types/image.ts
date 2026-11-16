/**
 * Canonical image + format types shared by the engine, workers and UI.
 *
 * Three concepts are deliberately kept apart (see README § Formats):
 *  - ImportedFormat   : what the bytes on disk actually are (signature sniffed)
 *  - DecodedImage     : the internal RGBA8 representation used for processing
 *  - OutputFormat     : what we encode the result as
 */

/** Formats we can read (decode) from disk. */
export type ImportedFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'gif'
  | 'svg'
  | 'heic'
  | 'tiff';

/** Formats we can write (encode) to disk. */
export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg';

export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'svg',
] as const;

export const IMPORTED_FORMATS: readonly ImportedFormat[] = [
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'svg',
  'heic',
  'tiff',
] as const;

/** A single composited animation frame (RGBA8, full logical canvas). */
export interface AnimationFrame {
  readonly data: Uint8ClampedArray;
  /** Frame delay in milliseconds. */
  readonly delayMs: number;
}

/**
 * Internal, codec-independent decoded representation.
 * `imageData` always holds the first (or only) frame at full logical size.
 */
export interface DecodedImage {
  readonly imageData: ImageData;
  readonly width: number;
  readonly height: number;
  /** True when at least one pixel has alpha < 255. */
  readonly hasAlpha: boolean;
  readonly isAnimated: boolean;
  /** Present only when `isAnimated`. Full-canvas frames, ready to re-encode. */
  readonly frames?: readonly AnimationFrame[];
  readonly sourceFormat: ImportedFormat;
  /** Original compressed byte length of the input, for accurate reporting. */
  readonly sourceBytes: number;
}

/** Sniffed descriptor of an uploaded file. */
export interface FileDescriptor {
  readonly format: ImportedFormat;
  readonly mimeType: string;
  readonly extension: string;
  readonly sizeBytes: number;
  /** How the format was determined — never trust the extension alone. */
  readonly detectedBy: 'signature' | 'mime+extension' | 'text-probe';
}
