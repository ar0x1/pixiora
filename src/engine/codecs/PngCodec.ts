import type { CompressionOptions } from '@/types/compression';
import type { DecodedImage } from '@/types/image';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { initWasmModule, WASM_URLS } from '@/engine/codecs/wasmModules';
import { getOxipng } from '@/engine/codecs/OxipngLoader';
import { decodeNative } from '@/engine/core/imageDecode';
import { applyResize } from '@/engine/optimization/resizeImage';

/**
 * PNG codec — squoosh PNG encoder + oxipng lossless re-compression.
 *
 * PNG quality semantics are deliberately different from JPEG: there is no
 * quality dial. What we expose as "effort" is oxipng's optimisation level,
 * which trades CPU time for a smaller *identical-pixel* file. The alpha channel
 * is preserved byte-for-byte; nothing is flattened here.
 */

type PngEncodeFn = ((data: ImageData, options?: { bitDepth?: 8 }) => Promise<ArrayBuffer>) & {
  init?: unknown;
};
type OxiFn = (
  data: Uint8Array,
  level: number,
  interlace: boolean,
  optimiseAlpha: boolean,
) => ArrayBuffer;

let pngEncode: PngEncodeFn | null = null;
let oxi: OxiFn | null = null;

export class PngCodec implements ImageCodec {
  readonly encodes = ['png'] as const;
  readonly decodes = ['png'] as const;

  async isSupported(): Promise<boolean> {
    return typeof WebAssembly === 'object';
  }

  async init(): Promise<void> {
    if (pngEncode && oxi) return;
    try {
      const encMod = (await initWasmModule('png-enc', WASM_URLS.pngEnc())) as { default?: PngEncodeFn } & PngEncodeFn;
      pngEncode = (encMod.default ?? encMod) as PngEncodeFn;
    } catch (error) {
      throw new EngineError(
        'WASM_INIT_FAILED',
        'The PNG encoder failed to load.',
        error instanceof Error ? error.message : String(error),
      );
    }
    // Single-threaded oxipng: works without SharedArrayBuffer or COOP/COEP.
    oxi = await getOxipng(WASM_URLS.oxipng());
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    return decodeNative(buffer, 'png');
  }

  async encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array> {
    await this.init();
    if (!pngEncode || !oxi) throw new EngineError('ENCODER_FAILED', 'PNG encoder is not available.');

    const { imageData } = applyResize(image.imageData, options);
    try {
      const raw = await pngEncode(imageData, { bitDepth: 8 });
      // --- Fast path -------------------------------------------------------
      // Squoosh's PNG encoder already writes a zlib stream with adaptive
      // filtering, so oxipng's job here is only to try better filter/deflate
      // combinations. At effort 6 that is a full second encode of the image and
      // it dominated the wall clock (a 3.7 MB PNG took ~5 s, of which ~4 s was
      // this call) for a few percent of size.
      //
      // Above ~1.5 MP we therefore run oxipng at a low effort: it still strips
      // redundant chunks and re-picks the filter, but it stops brute-forcing.
      // Below that threshold the image is small enough that maximum effort costs
      // little, so it is kept — small PNGs are where the last few percent matter.
      const pixels = imageData.width * imageData.height;
      const requested = Math.min(6, Math.max(0, options.effort ?? 2));
      const level = pixels > 1_500_000 ? Math.min(2, requested) : requested;
      const optimised = oxi(new Uint8Array(raw), level, false, options.preserveTransparency);
      return new Uint8Array(optimised);
    } catch (error) {
      throw EngineError.from(error, 'ENCODER_FAILED');
    }
  }

  async verify(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    // PNG dimensions live in the IHDR chunk: bytes 16..24 (big-endian).
    if (bytes.length < 24 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
      throw new EngineError('VERIFICATION_FAILED', 'Encoded PNG has an invalid IHDR signature.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
}
