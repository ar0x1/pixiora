import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import type { ImportedFormat, OutputFormat } from '@/types/image';
import { JpegCodec } from '@/engine/codecs/JpegCodec';
import { PngCodec } from '@/engine/codecs/PngCodec';
import { WebpCodec } from '@/engine/codecs/WebpCodec';
import { AvifCodec } from '@/engine/codecs/AvifCodec';
import { GifCodec } from '@/engine/codecs/GifCodec';
import { SvgCodec } from '@/engine/codecs/SvgCodec';
import { HeicCodec } from '@/engine/codecs/HeicCodec';
import { TiffCodec } from '@/engine/codecs/TiffCodec';

/**
 * Codec registry.
 *
 * Codecs are registered once and looked up by format. Lookup never constructs a
 * codec ad hoc, so WASM initialisation is amortised across every job in a
 * worker. The registry also owns capability reporting so the UI can disable
 * formats the current browser genuinely cannot produce.
 */

class CodecRegistry {
  private readonly encoders = new Map<OutputFormat, ImageCodec>();
  private readonly decoders = new Map<ImportedFormat, ImageCodec>();
  private supportCache = new Map<string, boolean>();

  constructor() {
    const jpeg = new JpegCodec();
    const png = new PngCodec();
    const webp = new WebpCodec();
    const avif = new AvifCodec();
    const gif = new GifCodec();
    const svg = new SvgCodec();
    const heic = new HeicCodec();
    const tiff = new TiffCodec();

    this.encoders.set('jpeg', jpeg);
    this.encoders.set('png', png);
    this.encoders.set('webp', webp);
    this.encoders.set('avif', avif);
    this.encoders.set('gif', gif);
    this.encoders.set('svg', svg);

    this.decoders.set('jpeg', jpeg);
    this.decoders.set('png', png);
    this.decoders.set('webp', webp);
    this.decoders.set('avif', avif);
    this.decoders.set('gif', gif);
    this.decoders.set('svg', svg);
    this.decoders.set('heic', heic);
    this.decoders.set('tiff', tiff);
  }

  encoderFor(format: OutputFormat): ImageCodec {
    const codec = this.encoders.get(format);
    if (!codec) {
      throw new EngineError('UNSUPPORTED_FORMAT', `PIXIORA cannot encode ${format.toUpperCase()} output.`);
    }
    return codec;
  }

  decoderFor(format: ImportedFormat): ImageCodec {
    const codec = this.decoders.get(format);
    if (!codec) {
      throw new EngineError('UNSUPPORTED_FORMAT', `PIXIORA cannot decode ${format.toUpperCase()} input.`);
    }
    return codec;
  }

  /** Capability probe with memoisation (WASM feature detection is not free). */
  async isEncodingSupported(format: OutputFormat): Promise<boolean> {
    const key = `enc:${format}`;
    const cached = this.supportCache.get(key);
    if (cached !== undefined) return cached;
    try {
      const supported = await this.encoderFor(format).isSupported();
      this.supportCache.set(key, supported);
      return supported;
    } catch {
      this.supportCache.set(key, false);
      return false;
    }
  }

  async isDecodingSupported(format: ImportedFormat): Promise<boolean> {
    const key = `dec:${format}`;
    const cached = this.supportCache.get(key);
    if (cached !== undefined) return cached;
    try {
      const supported = await this.decoderFor(format).isSupported();
      this.supportCache.set(key, supported);
      return supported;
    } catch {
      this.supportCache.set(key, false);
      return false;
    }
  }

  async supportedOutputs(): Promise<OutputFormat[]> {
    const formats: OutputFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif', 'svg'];
    const checks = await Promise.all(formats.map(async (f) => [f, await this.isEncodingSupported(f)] as const));
    return checks.filter(([, ok]) => ok).map(([f]) => f);
  }

  /** Pre-initialise an encoder ahead of time (used to hide latency). */
  async warm(format: OutputFormat): Promise<void> {
    await this.encoderFor(format).init();
  }
}

export const codecRegistry = new CodecRegistry();
export type { CodecRegistry };
