/**
 * Resource limits — configurable, documented, and enforced before allocation.
 *
 * A 100 MP image needs ~400 MB of RGBA. Browsers do not fail gracefully in that
 * situation; tabs die. So we refuse up-front with a typed error and a clear
 * explanation rather than letting the browser crash (spec §15).
 */

export interface EngineLimits {
  /** Maximum source file size in bytes — fixed ceiling of 250 MB. */
  maxFileBytes: number;
  /** Maximum total pixels — fixed ceiling of 150 MP. */
  maxPixels: number;
  /** Maximum single dimension (browsers cap canvas near 16384). */
  maxDimension: number;
  /**
   * RGBA memory ceiling per job. Derived from `maxPixels` (4 bytes per pixel)
   * rather than a flat constant, so the pixel ceiling is backed by a budget that
   * can actually be allocated instead of being refused by a hidden second cap.
   */
  maxRgbaBytes: number;
  /** How long a single encode may take before we give up (default 120 s). */
  jobTimeoutMs: number;
  /** Worker pool size ceiling (default 4). */
  maxWorkers: number;
}

/**
 * The hard ceiling of the engine. These are deliberately not user-editable:
 * a single, predictable limit is easier to reason about than per-user values, and
 * a 150 MP ceiling implies a ~600 MB RGBA allocation at 4 bytes per pixel.
 */
export const MAX_FILE_BYTES = 250 * 1024 * 1024;
export const MAX_PIXELS = 150_000_000;

export const DEFAULT_LIMITS: EngineLimits = {
  maxFileBytes: MAX_FILE_BYTES,
  maxPixels: MAX_PIXELS,
  maxDimension: 16384,
  maxRgbaBytes: MAX_PIXELS * 4,
  jobTimeoutMs: 120_000,
  maxWorkers: 4,
};

let current: EngineLimits = { ...DEFAULT_LIMITS };

export const getLimits = (): EngineLimits => current;

/** Overridable in tests and by a build-time env override; never by the UI. */
export const configureLimits = (overrides: Partial<EngineLimits>): EngineLimits => {
  current = { ...current, ...overrides };
  // Keep the memory budget consistent with the pixel ceiling unless it was
  // explicitly pinned by the caller.
  if (overrides.maxPixels !== undefined && overrides.maxRgbaBytes === undefined) {
    current.maxRgbaBytes = overrides.maxPixels * 4;
  }
  return current;
};

export const resetLimits = (): void => {
  current = { ...DEFAULT_LIMITS };
};

export const estimateRgbaBytes = (width: number, height: number): number => width * height * 4;

/**
 * Validate dimensions against limits. Returns null when OK, or a reason string.
 * Pure and synchronous so the UI can warn before any heavy work starts.
 */
export const checkDimensions = (
  width: number,
  height: number,
  limits: EngineLimits = current,
): { ok: true } | { ok: false; code: 'DIMENSIONS_EXCEEDED' | 'OUT_OF_MEMORY'; reason: string } => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ok: false, code: 'DIMENSIONS_EXCEEDED', reason: 'Image reports invalid dimensions.' };
  }
  if (width > limits.maxDimension || height > limits.maxDimension) {
    return {
      ok: false,
      code: 'DIMENSIONS_EXCEEDED',
      reason: `This image is ${width}×${height} — the maximum accepted side is ${limits.maxDimension} px.`,
    };
  }
  const pixels = width * height;
  if (pixels > limits.maxPixels) {
    return {
      ok: false,
      code: 'DIMENSIONS_EXCEEDED',
      reason: `This image is ${(pixels / 1_000_000).toFixed(1)} MP — the maximum accepted size is ${(limits.maxPixels / 1_000_000).toFixed(0)} MP.`,
    };
  }
  const rgba = estimateRgbaBytes(width, height);
  if (rgba > limits.maxRgbaBytes) {
    return {
      ok: false,
      code: 'OUT_OF_MEMORY',
      reason: `Decoding would need about ${Math.round(rgba / (1024 * 1024))} MB of memory; the limit is ${Math.round(limits.maxRgbaBytes / (1024 * 1024))} MB.`,
    };
  }
  return { ok: true };
};
