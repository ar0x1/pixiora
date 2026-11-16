import type { DecodedImage } from '@/types/image';
import type { CompressionOptions } from '@/types/compression';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { analyseAlpha } from '@/engine/optimization/transparency';

/**
 * HEIC/HEIF decoder — libheif compiled to WASM (libheif-js).
 *
 * Decode-only by design: we do not ship a HEVC *encoder* (licensing + size),
 * so PIXIORA never claims HEIC output. HEIC input converts to JPEG/PNG/WebP/AVIF.
 *
 * The bundle is ~2 MB and is dynamically imported only when a HEIC file is
 * actually opened, so it never affects first paint.
 */

interface HeifImage {
  get_width(): number;
  get_height(): number;
  has_alpha_channel?(): boolean;
  display(
    data: { data: Uint8ClampedArray; width: number; height: number },
    callback: (result: { data: Uint8ClampedArray; width: number; height: number } | null) => void,
  ): void;
}

interface LibHeif {
  HeifDecoder: new () => { decode(buffer: Uint8Array): HeifImage[] };
  heif_context_alloc?: unknown;
}

let libheifPromise: Promise<LibHeif> | null = null;

const loadLibheif = (): Promise<LibHeif> => {
  libheifPromise ??= (async () => {
    try {
      // The wasm-bundle build embeds the binary as base64: no extra fetch,
      // one self-contained module, works offline and behind strict CSP unset.
      const mod = (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')) as unknown as {
        default: () => Promise<LibHeif>;
      };
      return await mod.default();
    } catch (error) {
      libheifPromise = null;
      throw new EngineError('WASM_INIT_FAILED', 'The HEIC decoder (libheif) failed to load.', String(error));
    }
  })();
  return libheifPromise;
};

export class HeicCodec implements ImageCodec {
  readonly encodes = [] as const; // decode-only, intentionally
  readonly decodes = ['heic'] as const;

  async isSupported(): Promise<boolean> {
    return typeof WebAssembly === 'object';
  }

  async init(): Promise<void> {
    await loadLibheif();
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    const libheif = await loadLibheif();
    try {
      const decoder = new libheif.HeifDecoder();
      const images = decoder.decode(new Uint8Array(buffer));
      const primary = images[0];
      if (!primary) throw new EngineError('DECODER_FAILED', 'HEIC file contains no decodable images.');

      const width = primary.get_width();
      const height = primary.get_height();
      const data = new Uint8ClampedArray(width * height * 4);

      await new Promise<void>((resolve, reject) => {
        primary.display({ data, width, height }, (result) => {
          if (!result) {
            reject(new EngineError('DECODER_FAILED', 'libheif could not render the HEIC image.'));
            return;
          }
          if (result.data !== data) data.set(result.data);
          resolve();
        });
      });

      const alpha = analyseAlpha(data);
      return {
        imageData: new ImageData(data, width, height),
        width,
        height,
        hasAlpha: alpha.hasAlpha,
        isAnimated: false,
        sourceFormat: 'heic',
        sourceBytes: buffer.byteLength,
      };
    } catch (error) {
      if (error instanceof EngineError) throw error;
      throw new EngineError(
        'DECODER_FAILED',
        'This HEIC file could not be decoded. Some HEIC variants (e.g. 12-bit or HDR sequences) are unsupported.',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async encode(): Promise<Uint8Array> {
    throw new EngineError(
      'UNSUPPORTED_FORMAT',
      'PIXIORA does not encode HEIC. Convert to JPEG, PNG, WebP or AVIF instead.',
    );
  }

  async verify(): Promise<{ width: number; height: number }> {
    throw new EngineError('UNSUPPORTED_FORMAT', 'HEIC verification is not applicable (decode-only codec).');
  }
}

export type { CompressionOptions };
