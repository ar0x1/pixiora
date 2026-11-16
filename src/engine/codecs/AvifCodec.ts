import type { CompressionOptions } from '@/types/compression';
import type { DecodedImage } from '@/types/image';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { initWasmModule, WASM_URLS } from '@/engine/codecs/wasmModules';
import { decodeNative } from '@/engine/core/imageDecode';
import { applyResize } from '@/engine/optimization/resizeImage';

/**
 * AVIF codec — libavif via WASM (@jsquash/avif).
 *
 * AVIF is the slowest encoder we ship, so `speed` is exposed (0 slowest/smallest
 * → 10 fastest/largest). Default 6 balances both. Quality in libavif is a
 * 0–100 quantiser setting; equal numbers do NOT mean equal visual quality to
 * JPEG, which is why SMART mode uses a different baseline for AVIF.
 */

type EncodeFn = (data: ImageData, options: Record<string, unknown>) => Promise<ArrayBuffer>;
type DecodeFn = (buffer: ArrayBuffer) => Promise<ImageData>;

let encodeFn: EncodeFn | null = null;
let decodeFn: DecodeFn | null = null;

export class AvifCodec implements ImageCodec {
  readonly encodes = ['avif'] as const;
  readonly decodes = ['avif'] as const;

  async isSupported(): Promise<boolean> {
    return typeof WebAssembly === 'object';
  }

  async init(): Promise<void> {
    if (encodeFn && decodeFn) return;
    try {
      const enc = (await initWasmModule('avif-enc', WASM_URLS.avifEnc())) as { default?: EncodeFn } & EncodeFn;
      const dec = (await initWasmModule('avif-dec', WASM_URLS.avifDec())) as { default?: DecodeFn } & DecodeFn;
      encodeFn = (enc.default ?? enc) as EncodeFn;
      decodeFn = (dec.default ?? dec) as DecodeFn;
    } catch (error) {
      throw new EngineError('WASM_INIT_FAILED', 'The AVIF engine (libavif) failed to load.', String(error));
    }
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    return decodeNative(buffer, 'avif');
  }

  async encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array> {
    await this.init();
    if (!encodeFn) throw new EngineError('ENCODER_FAILED', 'AVIF encoder is not available.');

    const { imageData } = applyResize(image.imageData, options);
    const quality = Math.min(100, Math.max(1, Math.round(options.quality)));
    const speed = options.avifSpeed ?? 6;

    try {
      const buffer = await encodeFn(imageData, {
        quality,
        qualityAlpha: options.preserveTransparency ? -1 : 100, // -1 = derive from quality
        speed,
        lossless: options.lossless === true,
        tileColsLog2: 0,
        tileRowsLog2: 0,
        subsample: 1,
        chromaDeltaQ: false,
        sharpness: 0,
        denoiseLevel: 0,
        enableSharpYUV: true,
        bitDepth: 8,
      });
      return new Uint8Array(buffer);
    } catch (error) {
      throw EngineError.from(error, 'ENCODER_FAILED');
    }
  }

  async verify(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    // Container check: 'ftyp' box with an avif/avis brand.
    if (bytes.length < 32) throw new EngineError('VERIFICATION_FAILED', 'Encoded AVIF is truncated.');
    const brand = String.fromCharCode(
      bytes[8] as number, bytes[9] as number, bytes[10] as number, bytes[11] as number,
    );
    if (brand !== 'avif' && brand !== 'avis' && brand !== 'mif1') {
      throw new EngineError('VERIFICATION_FAILED', 'Encoded AVIF has an unexpected ftyp brand.');
    }
    // Full decode gives authoritative dimensions; AVIF box parsing is optional.
    await this.init();
    if (!decodeFn) throw new EngineError('VERIFICATION_FAILED', 'AVIF verifier unavailable.');
    const data = await decodeFn(bytes.slice().buffer as ArrayBuffer);
    return { width: data.width, height: data.height };
  }
}
