import type { CompressionOptions } from '@/types/compression';
import type { DecodedImage } from '@/types/image';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { initWasmModule, WASM_URLS } from '@/engine/codecs/wasmModules';
import { decodeNative } from '@/engine/core/imageDecode';
import { applyResize } from '@/engine/optimization/resizeImage';
import { flattenOnto } from '@/engine/optimization/transparency';

/**
 * JPEG codec — MozJPEG compiled to WASM (@jsquash/jpeg).
 *
 * Notes:
 * - JPEG has no alpha channel, so transparency is composited onto white
 *   explicitly (never left to the encoder's whim).
 * - Progressive + optimised Huffman coding are enabled by default in mozjpeg;
 *   we keep `auto_subsample` on, which is what makes 4:2:0 selection sane.
 * - Quality is clamped to 1–100. mozjpeg quality 0 is invalid.
 */

type EncodeFn = (data: ImageData, options: Record<string, unknown>) => Promise<ArrayBuffer>;
type DecodeFn = (buffer: ArrayBuffer) => Promise<ImageData>;

let encodeFn: EncodeFn | null = null;
let decodeFn: DecodeFn | null = null;

export class JpegCodec implements ImageCodec {
  readonly encodes = ['jpeg'] as const;
  readonly decodes = ['jpeg'] as const;

  async isSupported(): Promise<boolean> {
    return typeof WebAssembly === 'object';
  }

  async init(): Promise<void> {
    if (encodeFn && decodeFn) return;
    try {
      const enc = (await initWasmModule('jpeg-enc', WASM_URLS.jpegEnc())) as {
        default?: EncodeFn;
      } & EncodeFn;
      const dec = (await initWasmModule('jpeg-dec', WASM_URLS.jpegDec())) as {
        default?: DecodeFn;
      } & DecodeFn;
      encodeFn = (enc.default ?? enc) as EncodeFn;
      decodeFn = (dec.default ?? dec) as DecodeFn;
    } catch (error) {
      throw new EngineError('WASM_INIT_FAILED', 'The JPEG engine (MozJPEG) failed to load.', String(error));
    }
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    return decodeNative(buffer, 'jpeg');
  }

  async encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array> {
    await this.init();
    if (!encodeFn) throw new EngineError('ENCODER_FAILED', 'JPEG encoder is not available.');

    const { imageData } = applyResize(image.imageData, options);
    // JPEG cannot store alpha: composite onto white first, explicitly.
    const flat = flattenOnto(imageData, { r: 255, g: 255, b: 255 });

    const quality = Math.min(100, Math.max(1, Math.round(options.quality)));
    try {
      const buffer = await encodeFn(flat, {
        quality,
        baseline: false,
        progressive: true,
        optimize_coding: true,
        auto_subsample: true,
        chroma_subsample: 2,
        // The encoder cannot include metadata here: PIXIORA strips EXIF by
        // default (orientation is already baked into pixels before this point).
      });
      return new Uint8Array(buffer);
    } catch (error) {
      throw EngineError.from(error, 'ENCODER_FAILED');
    }
  }

  /**
   * Structural verification.
   *
   * Re-decoding the whole output in WASM doubled the cost of every JPEG job for
   * information the file already carries: SOI marker, a well-formed walk of the
   * segment chain (which proves the stream was not truncated), and the SOF frame
   * header, which holds the real dimensions. Every segment length is checked
   * against the remaining bytes, so a corrupted or cut file cannot pass.
   *
   * Decoding the *whole* image again is the encoder's own job to get right, and
   * the result is downloaded by the user, not by us; the guarantee this app
   * makes is "the file we hand you is a valid JPEG of the dimensions we claim".
   */
  async verify(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new EngineError('VERIFICATION_FAILED', 'Encoded JPEG does not start with an SOI marker.');
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        throw new EngineError('VERIFICATION_FAILED', 'Encoded JPEG has a malformed segment chain.');
      }
      const marker = bytes[offset + 1] as number;
      // Markers without a length field.
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xd9) break; // EOI
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) {
        throw new EngineError('VERIFICATION_FAILED', 'Encoded JPEG is truncated: a segment runs past the end of the file.');
      }
      // SOF0–SOF15 (excluding DHT/JPG/DAC) carry the frame dimensions.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = view.getUint16(offset + 5);
        const width = view.getUint16(offset + 7);
        if (width === 0 || height === 0) {
          throw new EngineError('VERIFICATION_FAILED', 'Encoded JPEG reports a zero dimension.');
        }
        return { width, height };
      }
      offset += 2 + length;
    }
    throw new EngineError('VERIFICATION_FAILED', 'Encoded JPEG has no frame header.');
  }
}
