import type { ImportedFormat, OutputFormat } from '@/types/image';

/**
 * Static capability matrix. Anything not listed here is *not* claimed to work.
 * `decodeEnv` records how each input is decoded so the UI can be honest about
 * why something might be unavailable in a given browser.
 */

export interface DecoderCapability {
  readonly input: ImportedFormat;
  /** Engine used to decode. */
  readonly via: 'wasm' | 'native-bitmap' | 'xml-parse';
  /** Package responsible, surfaced in Settings → Diagnostics. */
  readonly provider: string;
  readonly canDecode: readonly OutputFormat[];
  readonly preservesAnimation: boolean;
}

export const DECODERS: Record<ImportedFormat, DecoderCapability> = {
  jpeg: { input: 'jpeg', via: 'wasm', provider: '@jsquash/jpeg (mozjpeg)', canDecode: ['jpeg', 'png', 'webp', 'avif', 'gif'], preservesAnimation: false },
  png: { input: 'png', via: 'native-bitmap', provider: 'createImageBitmap + @jsquash/png fallback', canDecode: ['jpeg', 'png', 'webp', 'avif', 'gif'], preservesAnimation: false },
  webp: { input: 'webp', via: 'native-bitmap', provider: 'createImageBitmap + @jsquash/webp fallback', canDecode: ['jpeg', 'png', 'webp', 'avif', 'gif'], preservesAnimation: false },
  avif: { input: 'avif', via: 'native-bitmap', provider: 'createImageBitmap + @jsquash/avif fallback', canDecode: ['jpeg', 'png', 'webp', 'avif', 'gif'], preservesAnimation: false },
  gif: { input: 'gif', via: 'wasm', provider: 'gifuct-js', canDecode: ['gif', 'png', 'jpeg', 'webp', 'avif'], preservesAnimation: true },
  svg: { input: 'svg', via: 'xml-parse', provider: 'SVGO (sanitise + optimise)', canDecode: ['svg', 'png', 'jpeg', 'webp', 'avif'], preservesAnimation: false },
  heic: { input: 'heic', via: 'wasm', provider: 'libheif-js', canDecode: ['jpeg', 'png', 'webp', 'avif'], preservesAnimation: false },
  tiff: { input: 'tiff', via: 'wasm', provider: 'utif', canDecode: ['jpeg', 'png', 'webp', 'avif'], preservesAnimation: false },
};

export interface EncoderCapability {
  readonly format: OutputFormat;
  readonly mimeType: string;
  readonly extension: string;
  readonly label: string;
  readonly lossy: boolean;
  readonly supportsLossless: boolean;
  readonly transparency: 'full' | 'none' | 'binary';
  readonly animated: boolean;
  readonly provider: string;
  /** Rough speed class shown in the UI (honest, not a benchmark promise). */
  readonly speed: 'fast' | 'medium' | 'slow';
  /**
   * How strongly the produced bytes can be checked. `decode` means the output is
   * decoded again in full (the strongest proof, and the slowest); `scan` means the
   * container is walked end to end, which catches truncation and corruption for a
   * fraction of the cost.
   */
  readonly verify: 'decode' | 'scan';
}

export const ENCODERS: Record<OutputFormat, EncoderCapability> = {
  jpeg: { format: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg', label: 'JPEG', lossy: true, supportsLossless: false, transparency: 'none', animated: false, provider: '@jsquash/jpeg (mozjpeg)', speed: 'fast', verify: 'scan' },
  png: { format: 'png', mimeType: 'image/png', extension: 'png', label: 'PNG', lossy: false, supportsLossless: true, transparency: 'full', animated: false, provider: '@jsquash/png + oxipng', speed: 'medium', verify: 'scan' },
  webp: { format: 'webp', mimeType: 'image/webp', extension: 'webp', label: 'WebP', lossy: true, supportsLossless: true, transparency: 'full', animated: false, provider: '@jsquash/webp (libwebp)', speed: 'fast', verify: 'decode' },
  avif: { format: 'avif', mimeType: 'image/avif', extension: 'avif', label: 'AVIF', lossy: true, supportsLossless: true, transparency: 'full', animated: false, provider: '@jsquash/avif (libavif)', speed: 'slow', verify: 'decode' },
  gif: { format: 'gif', mimeType: 'image/gif', extension: 'gif', label: 'GIF', lossy: true, supportsLossless: false, transparency: 'binary', animated: true, provider: 'gifenc (quantised)', speed: 'medium', verify: 'scan' },
  svg: { format: 'svg', mimeType: 'image/svg+xml', extension: 'svg', label: 'SVG', lossy: false, supportsLossless: true, transparency: 'full', animated: false, provider: 'SVGO', speed: 'fast', verify: 'scan' },
};

/** Can this input be written as this output, in principle? */
export const canConvert = (input: ImportedFormat, output: OutputFormat): boolean =>
  DECODERS[input].canDecode.includes(output);

export const validTargetsFor = (input: ImportedFormat): readonly OutputFormat[] =>
  DECODERS[input].canDecode;

/**
 * Converting an animation into a still format is allowed but must be disclosed.
 * Returns a warning string, or null when no disclosure is needed.
 */
export const animationWarning = (isAnimated: boolean, output: OutputFormat): string | null => {
  if (!isAnimated) return null;
  if (output === 'gif') return null;
  return `Source is animated. ${ENCODERS[output].label} cannot store animation — only the first frame will be exported. Choose GIF to keep all frames.`;
};

/** Transparency loss disclosure for flattening formats. */
export const transparencyWarning = (hasAlpha: boolean, output: OutputFormat): string | null => {
  if (!hasAlpha) return null;
  if (ENCODERS[output].transparency === 'full') return null;
  if (ENCODERS[output].transparency === 'binary') {
    return 'GIF supports only 1-bit transparency; semi-transparent pixels will be quantised.';
  }
  return `${ENCODERS[output].label} has no alpha channel. Transparent areas will be flattened onto white.`;
};
