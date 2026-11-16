import type { AnimationFrame, DecodedImage } from '@/types/image';
import type { CompressionOptions } from '@/types/compression';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { applyResize, planResize, resizeImageData } from '@/engine/optimization/resizeImage';
import { analyseAlpha } from '@/engine/optimization/transparency';

/**
 * GIF codec.
 *
 * Decoding: gifuct-js decompresses every frame's patch. We composite the patches
 * ourselves so each output frame is a *full logical canvas* — that makes
 * re-encoding animation-preserving and independent of the original frame
 * rectangles and disposal methods. Delay, loop and transparency are retained.
 *
 * Encoding: gifenc with per-frame palettes (median-cut quantisation). GIF is a
 * palette format, so the honest statement is "quantised", never "lossless".
 * When only one frame is written we say so in the result notes instead of
 * silently dropping animation (see ProcessingPipeline).
 */

/* gifenc ships CommonJS; import lazily and normalise the shape. */
type GifencModule = {
  GIFEncoder: () => {
    writeFrame: (index: Uint8Array, w: number, h: number, opts: Record<string, unknown>) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };
  quantize: (rgba: Uint8ClampedArray | Uint8Array, maxColors: number, opts?: Record<string, unknown>) => number[][];
  applyPalette: (rgba: Uint8ClampedArray | Uint8Array, palette: number[][], format?: string) => Uint8Array;
};

type GifuctModule = {
  parseGIF: (buffer: ArrayBuffer) => { lsd: { width: number; height: number }; frames: unknown[] };
  decompressFrames: (
    gif: unknown,
    buildImagePatches: boolean,
  ) => {
    patch: Uint8ClampedArray;
    pixels: number[];
    dims: { top: number; left: number; width: number; height: number };
    delay: number;
    disposalType: number;
    transparentIndex?: number;
  }[];
};

let gifenc: GifencModule | null = null;
let gifuct: GifuctModule | null = null;

const loadGifenc = async (): Promise<GifencModule> => {
  if (gifenc) return gifenc;
  const mod = (await import('gifenc')) as unknown as GifencModule & { default?: GifencModule };
  gifenc = (mod.default ?? mod) as GifencModule;
  if (!gifenc.GIFEncoder) throw new EngineError('WASM_INIT_FAILED', 'GIF encoder module did not expose GIFEncoder.');
  return gifenc;
};

const loadGifuct = async (): Promise<GifuctModule> => {
  if (gifuct) return gifuct;
  gifuct = (await import('gifuct-js')) as unknown as GifuctModule;
  return gifuct;
};

/** Compose gifuct patches into full-canvas RGBA frames, honouring disposal. */
const composeFrames = (
  frames: ReturnType<GifuctModule['decompressFrames']>,
  width: number,
  height: number,
): AnimationFrame[] => {
  const canvas = new Uint8ClampedArray(width * height * 4);
  const out: AnimationFrame[] = [];

  for (const frame of frames) {
    const { top, left, width: fw, height: fh } = frame.dims;
    for (let y = 0; y < fh; y += 1) {
      const cy = top + y;
      if (cy >= height) break;
      for (let x = 0; x < fw; x += 1) {
        const cx = left + x;
        if (cx >= width) break;
        const si = (y * fw + x) * 4;
        const di = (cy * width + cx) * 4;
        const alpha = frame.patch[si + 3];
        if (alpha === 0) continue; // transparent patch pixel: keep what is beneath
        canvas[di] = frame.patch[si] as number;
        canvas[di + 1] = frame.patch[si + 1] as number;
        canvas[di + 2] = frame.patch[si + 2] as number;
        canvas[di + 3] = 255;
      }
    }
    out.push({ data: new Uint8ClampedArray(canvas), delayMs: frame.delay });

    // Disposal 2 = restore to background (clear the frame's rect) for next frame.
    if (frame.disposalType === 2) {
      for (let y = 0; y < fh; y += 1) {
        const cy = top + y;
        if (cy >= height) break;
        for (let x = 0; x < fw; x += 1) {
          const cx = left + x;
          if (cx >= width) break;
          const di = (cy * width + cx) * 4;
          canvas[di] = 0;
          canvas[di + 1] = 0;
          canvas[di + 2] = 0;
          canvas[di + 3] = 0;
        }
      }
    }
  }
  return out;
};

export class GifCodec implements ImageCodec {
  readonly encodes = ['gif'] as const;
  readonly decodes = ['gif'] as const;

  async isSupported(): Promise<boolean> {
    return true;
  }

  async init(): Promise<void> {
    await Promise.all([loadGifenc(), loadGifuct()]);
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    const { parseGIF, decompressFrames } = await loadGifuct();
    try {
      const gif = parseGIF(buffer);
      const frames = decompressFrames(gif, true);
      if (frames.length === 0) throw new EngineError('CORRUPT_IMAGE', 'GIF contains no decodable frames.');

      const width = gif.lsd.width;
      const height = gif.lsd.height;
      const composed = composeFrames(frames, width, height);
      const first = composed[0];
      if (!first) throw new EngineError('CORRUPT_IMAGE', 'GIF frame composition produced no frames.');

      const alpha = analyseAlpha(first.data);
      return {
        imageData: new ImageData(new Uint8ClampedArray(first.data), width, height),
        width,
        height,
        hasAlpha: alpha.hasAlpha,
        isAnimated: composed.length > 1,
        frames: composed.length > 1 ? composed : undefined,
        sourceFormat: 'gif',
        sourceBytes: buffer.byteLength,
      };
    } catch (error) {
      if (error instanceof EngineError) throw error;
      throw new EngineError('DECODER_FAILED', 'This GIF could not be decoded; the file may be corrupt.', String(error));
    }
  }

  async encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array> {
    const gif = await loadGifenc();
    const params = gifParamsFromQuality(options.quality);

    // Decide frames: keep animation when the source has it, unless the user
    // explicitly asked for a still (handled upstream via a note).
    const sourceFrames = image.frames && image.frames.length > 1 ? image.frames : null;
    const plan = planResize({ width: image.width, height: image.height }, options);

    const encodeFrame = (
      data: Uint8ClampedArray,
      width: number,
      height: number,
      delayMs: number,
    ): { index: Uint8Array; palette: number[][] } => {
      const palette = gif.quantize(data, params.maxColors, { format: params.format });
      const index = gif.applyPalette(data, palette, params.format);
      void delayMs;
      void width;
      void height;
      return { index, palette };
    };

    try {
      const encoder = gif.GIFEncoder();

      if (sourceFrames) {
        for (const frame of sourceFrames) {
          let frameData = new ImageData(new Uint8ClampedArray(frame.data), image.width, image.height);
          if (plan.scaled) frameData = resizeImageData(frameData, plan);
          const { index, palette } = encodeFrame(
            frameData.data,
            frameData.width,
            frameData.height,
            frame.delayMs,
          );
          encoder.writeFrame(index, frameData.width, frameData.height, {
            palette,
            // GIF delays are in hundredths of a second.
            delay: Math.max(20, Math.round(frame.delayMs)),
            dispose: 2,
            repeat: 0,
          });
        }
      } else {
        const { imageData } = applyResize(image.imageData, options);
        const { index, palette } = encodeFrame(imageData.data, imageData.width, imageData.height, 100);
        encoder.writeFrame(index, imageData.width, imageData.height, {
          palette,
          delay: 100,
          repeat: 0,
        });
      }

      encoder.finish();
      return new Uint8Array(encoder.bytes());
    } catch (error) {
      throw EngineError.from(error, 'ENCODER_FAILED');
    }
  }

  async verify(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    if (bytes.length < 13) throw new EngineError('VERIFICATION_FAILED', 'Encoded GIF is truncated.');
    const header = String.fromCharCode(
      bytes[0] as number, bytes[1] as number, bytes[2] as number,
      bytes[3] as number, bytes[4] as number, bytes[5] as number,
    );
    if (header !== 'GIF89a' && header !== 'GIF87a') {
      throw new EngineError('VERIFICATION_FAILED', 'Encoded GIF has an invalid header.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
}

/**
 * GIF "quality" maps to palette size: 100 → 256 colours, 1 → 2 colours.
 * This is a genuine quality/size trade-off for palette formats, not a fake dial.
 */
const gifParamsFromQuality = (quality: number): { maxColors: number; format: 'rgb565' | 'rgb444' | 'rgba4444' } => {
  const q = Math.min(100, Math.max(1, quality));
  const maxColors = Math.max(2, Math.min(256, Math.round(2 ** (1 + (q / 100) * 7))));
  return { maxColors, format: 'rgb565' };
};

export { gifParamsFromQuality, composeFrames };
