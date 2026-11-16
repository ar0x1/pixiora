import type { CompressionOptions } from '@/types/compression';
import type { ImportedFormat, OutputFormat } from '@/types/image';

/**
 * SMART MODE.
 *
 * Picks a starting quality from measurable image facts only — never random,
 * never a "magic" number pulled from thin air. The resulting settings are always
 * shown to the user (see AppliedSettings.reason) so the decision is inspectable.
 *
 * Quality and effort are locked app-wide (see LOCKED_QUALITY / LOCKED_EFFORT), so
 * this module now only decides the per-image *lossless* flag and explains it.
 *
 * Historical heuristics, kept for the lossless decision:
 *  1. Lossless-only targets (PNG/SVG) do not use a quality slider at all.
 *  2. Transparency + JPEG would destroy alpha, so it starts conservatively.
 *  3. Megapixels: big images tolerate lower quality because viewers scale them.
 *  4. Source format hints: re-encoding an already-lossy source that was small
 *     gets a higher floor to avoid double-compression mush.
 *  5. AVIF/WebP can afford lower numbers than JPEG for equal perceived quality.
 */

export interface SmartDecision {
  readonly quality: number;
  readonly lossless: boolean;
  readonly effort: number;
  readonly reason: string;
}

export interface SmartInput {
  readonly sourceFormat: ImportedFormat;
  readonly outputFormat: OutputFormat;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly sourceBytes: number;
}

/**
 * Locked quality. Quality is no longer a user-facing control, so every job encodes
 * at this value. 60 is the point where a re-encode reliably comes out *smaller*
 * than a typical source; at 100 the app could (and did) return files up to ~2.7×
 * larger than the input.
 */
export const LOCKED_QUALITY = 50;
/** Locked compression effort — the most CPU, the smallest possible output. */
export const LOCKED_EFFORT = 6;

export const chooseSmartSettings = (input: SmartInput): SmartDecision => {
  const { outputFormat, width, height } = input;

  // 1. Lossless-only targets (PNG/SVG) never use a lossy quality at all.
  if (outputFormat === 'png') {
    return {
      quality: LOCKED_QUALITY,
      lossless: true,
      effort: LOCKED_EFFORT,
      reason: 'PNG is optimised losslessly by oxipng, so quality is not lossy-reduced.',
    };
  }
  if (outputFormat === 'svg') {
    return {
      quality: LOCKED_QUALITY,
      lossless: true,
      effort: LOCKED_EFFORT,
      reason: 'SVG is optimised as vector XML; quality does not apply.',
    };
  }

  // 2. Everything else encodes at the locked quality; only the explanation varies.
  const megapixels = (width * height) / 1_000_000;
  const sizeNote =
    megapixels >= 4
      ? `${megapixels.toFixed(1)} MP source`
      : megapixels < 0.15
        ? 'small source'
        : `${megapixels.toFixed(2)} MP source`;

  return {
    quality: LOCKED_QUALITY,
    lossless: false,
    effort: LOCKED_EFFORT,
    reason: `Quality is locked at ${LOCKED_QUALITY} to keep the output smaller than the source (${sizeNote}); effort is locked at ${LOCKED_EFFORT} for the smallest possible file.`,
  };
};

/** Apply a smart decision on top of user options, preserving explicit overrides. */
export const withSmartMode = (options: CompressionOptions, input: SmartInput): CompressionOptions => {
  if (options.mode !== 'smart') return options;
  const decision = chooseSmartSettings({ ...input, outputFormat: options.format });
  return {
    ...options,
    quality: LOCKED_QUALITY,
    lossless: decision.lossless,
    effort: LOCKED_EFFORT,
    avifSpeed: options.avifSpeed ?? LOCKED_EFFORT,
  };
};
