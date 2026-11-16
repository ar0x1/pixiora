import type { CompressionOptions } from '@/types/compression';
import type { DecodedImage } from '@/types/image';

/**
 * The codec contract. UI never depends on this; only the engine and workers do.
 * Every codec must be able to *decode its own output* for verification, except
 * SVG (vector, verified by XML well-formedness instead).
 */
export interface ImageCodec {
  /** Output formats this codec can write. */
  readonly encodes: readonly string[];
  /** Input formats this codec can read. */
  readonly decodes: readonly string[];
  /** Cheap capability probe — does this browser/environment support the codec? */
  isSupported(): Promise<boolean>;
  /** Warm up WASM / register workers. Idempotent. */
  init(): Promise<void>;
  /** Decode raw bytes into the canonical RGBA representation. */
  decode(buffer: ArrayBuffer, hint: string): Promise<DecodedImage>;
  /** Encode a decoded image. Returns encoded bytes. */
  encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array>;
  /**
   * Optional: re-decode produced bytes to prove the output is valid.
   * Returns dimensions when decodable, or throws EngineError.
   */
  verify?(bytes: Uint8Array, options: CompressionOptions): Promise<{ width: number; height: number }>;
}

/** Normalised error codes — the UI maps these to human copy. */
export type EngineErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'UNDECODABLE'
  | 'CORRUPT_IMAGE'
  | 'INVALID_SIGNATURE'
  | 'IMAGE_TOO_LARGE'
  | 'DIMENSIONS_EXCEEDED'
  | 'OUT_OF_MEMORY'
  | 'WASM_INIT_FAILED'
  | 'WORKER_FAILED'
  | 'ENCODER_FAILED'
  | 'DECODER_FAILED'
  | 'CONVERSION_FAILED'
  | 'VERIFICATION_FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly detail?: string;

  constructor(code: EngineErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.detail = detail;
  }

  static from(error: unknown, fallback: EngineErrorCode = 'UNKNOWN'): EngineError {
    if (error instanceof EngineError) return error;
    const message = error instanceof Error ? error.message : String(error);
    if (/out of memory|allocation failed|Cannot allocate/i.test(message)) {
      return new EngineError('OUT_OF_MEMORY', 'The browser ran out of memory for this image.', message);
    }
    return new EngineError(fallback, message, error instanceof Error ? error.stack : undefined);
  }
}

export class CancelledError extends EngineError {
  constructor() {
    super('CANCELLED', 'Operation cancelled.');
    this.name = 'CancelledError';
  }
}
