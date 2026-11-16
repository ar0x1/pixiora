import type { OutputFormat } from '@/types/image';
import { ENCODERS } from '@/engine/formats/formatCapabilities';

/** Single source of truth for MIME ↔ extension mapping. */
export const mimeFor = (format: OutputFormat): string => ENCODERS[format].mimeType;

export const extensionFor = (format: OutputFormat): string => ENCODERS[format].extension;

export const labelFor = (format: OutputFormat): string => ENCODERS[format].label;

export const formatFromMime = (mime: string): OutputFormat | null => {
  const found = Object.values(ENCODERS).find((e) => e.mimeType === mime.toLowerCase());
  return found ? found.format : null;
};

/**
 * Build a safe output filename: keeps the stem, swaps the extension, strips
 * path separators and characters that break Windows/macOS/Linux alike.
 */
export const outputFileName = (originalName: string, format: OutputFormat, suffix = '-pixiora'): string => {
  // Take the basename first: a download filename must never contain a path.
  const baseName = originalName.split(/[/\\]/).pop() ?? originalName;
  const stem = baseName
    .replace(/\.[^./\\]+$/, '')
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-')
    .slice(0, 120)
    .trim() || 'image';
  return `${stem}${suffix}.${extensionFor(format)}`;
};
