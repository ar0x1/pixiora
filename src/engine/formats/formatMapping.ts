import type { ImportedFormat, OutputFormat } from '@/types/image';
import { DECODERS, ENCODERS } from '@/engine/formats/formatCapabilities';

/**
 * Default output per input when the selector is "Auto".
 * Philosophy: keep the format when it is already web-optimal, otherwise pick the
 * best modern equivalent — but never change the user's explicit choice.
 */
const DEFAULT_OUTPUT: Record<ImportedFormat, OutputFormat> = {
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  gif: 'gif',
  svg: 'svg',
  heic: 'webp', // HEIC/HEIF are not web formats; WebP keeps alpha + quality
  tiff: 'webp',
};

/** Friendly names for the UI. */
export const formatLabel = (format: ImportedFormat | OutputFormat): string =>
  (ENCODERS as Record<string, { label: string }>)[format]?.label ?? format.toUpperCase();

export const decoderProvider = (format: ImportedFormat): string => DECODERS[format].provider;

export const encoderProvider = (format: OutputFormat): string => ENCODERS[format].provider;

/**
 * Decide the default output format for a given input.
 * Philosophy: keep the user's format when it is already web-optimal, otherwise
 * suggest the best modern equivalent but never change it behind their back.
 */
/** Format used for output when the user leaves the selector on "Auto". */
export const defaultOutputFormat = (input: ImportedFormat): OutputFormat => DEFAULT_OUTPUT[input];

/** Formats where a quality slider is meaningless (lossless-only). */
export const usesQualitySlider = (format: OutputFormat): boolean =>
  format !== 'png' && format !== 'svg';

/** Human explanation used in tooltips next to disabled controls. */
export const qualityExplanation = (format: OutputFormat): string => {
  if (format === 'png') return 'PNG is optimised losslessly (oxipng). Quality is not reduced.';
  if (format === 'svg') return 'SVG is optimised as markup (SVGO). Quality does not apply.';
  if (format === 'gif') return 'GIF quality controls colour quantisation depth.';
  return 'Lower quality means a smaller file and more visible artefacts.';
};
