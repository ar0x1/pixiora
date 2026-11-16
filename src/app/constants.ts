import { Boxes, Gauge, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Navigation model — single source of truth for routes, tabs and labels.
 *
 * Workspaces are the primary tabs. The info page is deliberately NOT part of the
 * tab row: it is a reference you visit occasionally, so it lives as an icon in
 * the top bar's right-hand action cluster. It is named "Documentation" because
 * there is nothing to configure — no sliders, no switches, no preferences.
 */
export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Compressor', description: 'Compress one image with a live before/after comparison slider', icon: Gauge },
  { path: '/convert', label: 'Converter', description: 'Convert between JPEG, PNG, WebP, AVIF, GIF and SVG', icon: Boxes },
] as const;

export const SETTINGS_ITEM: NavItem = {
  path: '/settings',
  label: 'Documentation',
  description: 'Engine contract, licence and contact details',
  icon: Info,
};

/** Every route the app knows about, for lookups such as the page title. */
export const ALL_NAV_ITEMS: readonly NavItem[] = [...NAV_ITEMS, SETTINGS_ITEM];

export const APP_NAME = 'PIXIORA';
export const APP_TAGLINE = 'Image Optimization Studio';

/** Contact + source links. Both are opened with rel="noopener noreferrer". */
export const CONTACT_EMAIL = 'killtoneizuku@gmail.com';
export const SOURCE_URL = 'https://github.com/ar0x1/pixiora';
export const AUTHOR = 'ar0x';
export const APP_VERSION = '1.0.0';

/** Human copy for every engine error code (never show a raw code alone). */
export const ERROR_COPY: Record<string, { title: string; advice: string }> = {
  UNSUPPORTED_FORMAT: {
    title: 'Unsupported format',
    advice: 'PIXIORA handles JPEG, PNG, WebP, AVIF, GIF, SVG, HEIC and TIFF.',
  },
  UNDECODABLE: { title: 'Undecodable file', advice: 'The file could not be decoded by any available decoder.' },
  CORRUPT_IMAGE: { title: 'Corrupt image', advice: 'The file appears damaged. Try re-exporting it from the original app.' },
  INVALID_SIGNATURE: { title: 'File type mismatch', advice: 'The contents do not match the file type. It may be mislabelled.' },
  IMAGE_TOO_LARGE: { title: 'File too large', advice: 'The maximum accepted file size is 250 MB. Nothing was decoded or stored.' },
  DIMENSIONS_EXCEEDED: { title: 'Too many pixels', advice: 'The maximum accepted size is 150 megapixels (or 16384 px on a single side).' },
  OUT_OF_MEMORY: { title: 'Out of memory', advice: 'Close other tabs or process a smaller version of this image.' },
  WASM_INIT_FAILED: { title: 'Codec failed to load', advice: 'The WebAssembly codec could not initialise. Reload and try again.' },
  WORKER_FAILED: { title: 'Background worker failed', advice: 'The job ran on a worker that crashed. Retry the file.' },
  ENCODER_FAILED: { title: 'Encoding failed', advice: 'This image could not be encoded with the selected settings.' },
  DECODER_FAILED: { title: 'Decoding failed', advice: 'This variant may use features the decoder does not support.' },
  CONVERSION_FAILED: { title: 'Conversion failed', advice: 'That conversion is not possible for this file.' },
  VERIFICATION_FAILED: { title: 'Output failed verification', advice: 'The result was discarded rather than offering a broken file.' },
  CANCELLED: { title: 'Cancelled', advice: 'The operation was cancelled.' },
  TIMEOUT: { title: 'Timed out', advice: 'The job exceeded its time budget. Try a smaller image or a faster format.' },
  UNKNOWN: { title: 'Something went wrong', advice: 'An unexpected error occurred. Details are shown below.' },
};

/** Guaranteed-non-null lookup so callers never branch on undefined copy. */
export const errorCopy = (code: string): { title: string; advice: string } =>
  ERROR_COPY[code] ?? ERROR_COPY.UNKNOWN ?? { title: 'Something went wrong', advice: 'An unexpected error occurred.' };
