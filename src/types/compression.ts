import type { OutputFormat } from './image';

/**
 * How the user wants quality decided.
 *
 * `lossless` is not a user choice: it is the mode the panel forces for formats
 * whose encoder has no quality dial (PNG, SVG). Quality is then always at
 * maximum by construction, so offering a slider would be a lie.
 */
export type CompressionMode = 'quality' | 'target-size' | 'smart' | 'lossless';

export const COMPRESSION_MODES: readonly CompressionMode[] = ['quality', 'target-size', 'smart'] as const;

/** Fully-resolved settings handed to the engine for one job. */
export interface CompressionOptions {
  /** 1–100. Ignored (but still recorded) for lossless PNG/SVG paths. */
  readonly quality: number;
  readonly format: OutputFormat;
  readonly mode: CompressionMode;
  /** Only meaningful for `mode: 'target-size'`, in bytes. */
  readonly targetSizeBytes?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly preserveTransparency: boolean;
  readonly stripMetadata: boolean;
  /** Lossless encoding where the codec supports it (WebP/AVIF/PNG). */
  readonly lossless?: boolean;
  /** PNG/WebP lossless effort level; higher = smaller + slower. */
  readonly effort?: number;
  /** Resize policy when only one dimension is given. */
  readonly fitMode?: 'contain' | 'cover' | 'fill';
  /** Allow the output to be larger than the input dimensions. */
  readonly allowUpscale?: boolean;
  /** AVIF encoder speed 0–10 (higher = faster, larger). */
  readonly avifSpeed?: number;
}

/** What the engine actually did — surfaced in the UI, never hidden. */
export interface AppliedSettings {
  readonly format: OutputFormat;
  readonly quality: number;
  readonly lossless: boolean;
  /** Encoding attempts performed (target-size mode may run several). */
  readonly attempts: number;
  /** Dimensions actually written. */
  readonly width: number;
  readonly height: number;
  readonly scaled: boolean;
  readonly reason: string;
}

export interface CompressionResult {
  readonly blob: Blob;
  readonly originalSize: number;
  readonly compressedSize: number;
  readonly width: number;
  readonly height: number;
  readonly format: OutputFormat;
  readonly mimeType: string;
  readonly processingTimeMs: number;
  readonly applied: AppliedSettings;
  readonly verification: VerificationReport;
  /** Human-readable caveats (e.g. target size unreachable). */
  readonly notes: readonly string[];
}

/**
 * Proof that the produced bytes are a valid image of the expected size.
 *
 * Three strengths, and the UI states which one applied rather than pretending
 * they are equivalent:
 *  - `codec-decode`   — the output was decoded again, pixel for pixel.
 *  - `structure-scan` — the container was walked end to end (marker/segment
 *                       chain, frame header, CRCs where the format has them).
 *                       Cheap, and it still catches truncation and corruption.
 *  - `signature-only` — only the magic bytes could be checked.
 */
export interface VerificationReport {
  readonly verified: boolean;
  readonly decodedWidth: number;
  readonly decodedHeight: number;
  readonly method: 'codec-decode' | 'structure-scan' | 'signature-only';
  readonly detail: string;
}

/** Phases reported truthfully by the worker (no invented percentages). */
export type ProcessingPhase =
  | 'queued'
  | 'decoding'
  | 'resizing'
  | 'encoding'
  | 'verifying'
  | 'finalizing';

export interface PhaseProgress {
  readonly phase: ProcessingPhase;
  /** Attempt index for iterative encoders (target-size). */
  readonly attempt?: number;
  readonly attemptsTotal?: number;
}

export interface Savings {
  readonly bytes: number;
  readonly percent: number;
  /** Negative savings (output larger than input) are reported honestly. */
  readonly grew: boolean;
}
