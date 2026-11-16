import type { CompressionOptions } from '@/types/compression';
import type { DecodedImage } from '@/types/image';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { initWasmModule, WASM_URLS } from '@/engine/codecs/wasmModules';
import { decodeNative } from '@/engine/core/imageDecode';
import { applyResize } from '@/engine/optimization/resizeImage';

/**
 * WebP codec — libwebp via WASM (@jsquash/webp).
 *
 * WebP supports full alpha and true lossless mode. When `lossless` is requested
 * we switch to lossless=1 and use `exact` so RGB values under transparent pixels
 * are preserved (otherwise edges "halo" when re-composited).
 */

type EncodeFn = (data: ImageData, options: Record<string, unknown>) => Promise<ArrayBuffer>;
type DecodeFn = (buffer: ArrayBuffer) => Promise<ImageData>;

let encodeFn: EncodeFn | null = null;
let decodeFn: DecodeFn | null = null;

export class WebpCodec implements ImageCodec {
  readonly encodes = ['webp'] as const;
  readonly decodes = ['webp'] as const;

  async isSupported(): Promise<boolean> {
    return typeof WebAssembly === 'object';
  }

  async init(): Promise<void> {
    if (encodeFn && decodeFn) return;
    try {
      const enc = (await initWasmModule('webp-enc', WASM_URLS.webpEnc())) as { default?: EncodeFn } & EncodeFn;
      const dec = (await initWasmModule('webp-dec', WASM_URLS.webpDec())) as { default?: DecodeFn } & DecodeFn;
      encodeFn = (enc.default ?? enc) as EncodeFn;
      decodeFn = (dec.default ?? dec) as DecodeFn;
    } catch (error) {
      throw new EngineError('WASM_INIT_FAILED', 'The WebP engine (libwebp) failed to load.', String(error));
    }
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    return decodeNative(buffer, 'webp');
  }

  async encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array> {
    await this.init();
    if (!encodeFn) throw new EngineError('ENCODER_FAILED', 'WebP encoder is not available.');

    const { imageData } = applyResize(image.imageData, options);
    const quality = Math.min(100, Math.max(1, Math.round(options.quality)));

    try {
      const buffer = await encodeFn(
        imageData,
        options.lossless
          ? { lossless: 1, quality: 100, exact: 1, method: 4, alpha_compression: 1, alpha_quality: 100 }
          : {
              lossless: 0,
              quality,
              method: 4,
              sns_strength: 50,
              filter_strength: 60,
              segments: 4,
              alpha_compression: 1, // keep alpha efficient
              alpha_quality: Math.max(60, quality), // never degrade the matte
              exact: 0,
            },
      );
      return new Uint8Array(buffer);
    } catch (error) {
      throw EngineError.from(error, 'ENCODER_FAILED');
    }
  }

  async verify(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    // Parse the VP8X / VP8 / VP8L header for real dimensions (no full decode).
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const riff = String.fromCharCode(bytes[0] as number, bytes[1] as number, bytes[2] as number, bytes[3] as number);
    const webp = String.fromCharCode(bytes[8] as number, bytes[9] as number, bytes[10] as number, bytes[11] as number);
    if (riff !== 'RIFF' || webp !== 'WEBP') {
      throw new EngineError('VERIFICATION_FAILED', 'Encoded WebP has an invalid RIFF header.');
    }
    const chunk = String.fromCharCode(bytes[12] as number, bytes[13] as number, bytes[14] as number, bytes[15] as number);
    if (chunk === 'VP8X') {
      const w = 1 + ((view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16)));
      const h = 1 + ((view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16)));
      return { width: w, height: h };
    }
    if (chunk === 'VP8 ') {
      const w = view.getUint16(26, true) & 0x3fff;
      const h = view.getUint16(28, true) & 0x3fff;
      return { width: w, height: h };
    }
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    // Unknown layout: fall back to a real decode rather than guessing.
    await this.init();
    if (!decodeFn) throw new EngineError('VERIFICATION_FAILED', 'WebP verifier unavailable.');
    const data = await decodeFn(bytes.slice().buffer as ArrayBuffer);
    return { width: data.width, height: data.height };
  }
}
