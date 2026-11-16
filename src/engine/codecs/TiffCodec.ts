import type { DecodedImage } from '@/types/image';
import type { CompressionOptions } from '@/types/compression';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { analyseAlpha } from '@/engine/optimization/transparency';
import { applyOrientation, orientationSwapsAxes } from '@/engine/optimization/metadata';

/**
 * TIFF decoder — UTIF (pure JS/WASM-free).
 *
 * TIFF is a container with dozens of variants. UTIF handles the common
 * uncompressed/LZW/Deflate RGB and greyscale cases; exotic compressions
 * (JPEG-in-TIFF, float/CMYK Lab) may fail and we surface that honestly instead
 * of producing garbage. Decode-only: PIXIORA has no TIFF encoder.
 */

interface UtifIfd {
  width?: number;
  height?: number;
  t256?: number[];
  t257?: number[];
  isLE?: boolean;
  [key: string]: unknown;
}

interface UtifModule {
  decode(buffer: ArrayBuffer): UtifIfd[];
  decodeImage(buffer: ArrayBuffer, ifd: UtifIfd, ifds?: UtifIfd[]): void;
  toRGBA8(ifd: UtifIfd): Uint8Array;
}

let utif: UtifModule | null = null;

const loadUtif = async (): Promise<UtifModule> => {
  if (utif) return utif;
  const mod = (await import('utif')) as unknown as UtifModule & { default?: UtifModule };
  utif = (mod.default ?? mod) as UtifModule;
  if (typeof utif.decode !== 'function') {
    throw new EngineError('WASM_INIT_FAILED', 'TIFF decoder module did not expose decode().');
  }
  return utif;
};

export class TiffCodec implements ImageCodec {
  readonly encodes = [] as const; // decode-only
  readonly decodes = ['tiff'] as const;

  async isSupported(): Promise<boolean> {
    return true;
  }

  async init(): Promise<void> {
    await loadUtif();
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    const lib = await loadUtif();
    try {
      const ifds = lib.decode(buffer);
      const ifd = ifds[0];
      if (!ifd) throw new EngineError('DECODER_FAILED', 'TIFF file contains no image directories.');

      lib.decodeImage(buffer, ifd, ifds);
      const width = ifd.width ?? ifd.t256?.[0] ?? 0;
      const height = ifd.height ?? ifd.t257?.[0] ?? 0;
      if (!width || !height) {
        throw new EngineError('DECODER_FAILED', 'TIFF image directory has no usable dimensions.');
      }

      const rgba = lib.toRGBA8(ifd);
      const data = new Uint8ClampedArray(rgba.length);
      data.set(rgba);

      let imageData = new ImageData(data, width, height);
      // TIFF stores orientation in tag 274; UTIF exposes it as t274 (array).
      const orientationTag = (ifd as { t274?: number[] }).t274;
      const orientation = orientationTag?.[0];
      if (orientation && orientation >= 1 && orientation <= 8) {
        imageData = applyOrientation(imageData, orientation as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
      }

      const alpha = analyseAlpha(imageData.data);
      return {
        imageData,
        width: imageData.width,
        height: imageData.height,
        hasAlpha: alpha.hasAlpha,
        isAnimated: false,
        sourceFormat: 'tiff',
        sourceBytes: buffer.byteLength,
      };
    } catch (error) {
      if (error instanceof EngineError) throw error;
      throw new EngineError(
        'DECODER_FAILED',
        'This TIFF could not be decoded. Multi-page, CMYK or JPEG-compressed TIFFs may be unsupported.',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async encode(): Promise<Uint8Array> {
    throw new EngineError('UNSUPPORTED_FORMAT', 'PIXIORA does not encode TIFF. Convert to JPEG, PNG, WebP or AVIF instead.');
  }

  async verify(): Promise<{ width: number; height: number }> {
    throw new EngineError('UNSUPPORTED_FORMAT', 'TIFF verification is not applicable (decode-only codec).');
  }
}

export { orientationSwapsAxes };
export type { CompressionOptions };
