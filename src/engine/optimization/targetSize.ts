import { EngineError } from '@/engine/core/EngineTypes';

/**
 * TARGET SIZE MODE — bounded iterative encoding.
 *
 * The spec is explicit that quality→size must not be assumed linear *or*
 * monotonic, so this is not a naive "guess, then step" loop. It is a bracket +
 * binary search over measured encodes:
 *
 *   1. Probe both ends of the allowed quality range (2 real encodes).
 *   2. If neither end fits, probe the midpoint once. A non-monotonic encoder
 *      (e.g. one whose optimal table choice dips in the middle) can fit there
 *      even when both extremes overshoot. Without this probe we would report
 *      "impossible" for a target that is actually reachable.
 *   3. If nothing fits, report the smallest *measured* result and say so.
 *   4. Otherwise binary-search between the best fitting quality and a known
 *      failing quality, halving each time, always keeping measured candidates.
 *   5. The winner is the HIGHEST quality that still fits — maximum visual
 *      quality inside the size budget, never the smallest file.
 *
 * Every attempt is a real encode; the returned `attempts` count is the true
 * number of encodes performed. Nothing here invents progress.
 */

export interface TargetSizeConfig {
  readonly targetBytes: number;
  readonly minQuality?: number;
  readonly maxQuality?: number;
  /** Accept when size is within this fraction *under* the target. Default 3%. */
  readonly toleranceRatio?: number;
  /** Hard cap on encode attempts. Default 7. */
  readonly maxAttempts?: number;
  /** Wall-clock budget for the whole search. Default 20s. */
  readonly timeBudgetMs?: number;
}

export interface EncodeAttempt {
  readonly bytes: Uint8Array;
  readonly quality: number;
}

export interface TargetSizeOutcome {
  readonly best: EncodeAttempt;
  readonly attempts: number;
  readonly achieved: boolean;
  /** Smallest byte length observed at any quality. */
  readonly floorBytes: number;
  /** Largest byte length observed at any quality. */
  readonly ceilingBytes: number;
  readonly explanation: string;
  readonly history: readonly { quality: number; bytes: number }[];
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const findTargetSize = async (
  config: TargetSizeConfig,
  encodeAt: (quality: number, attempt: number) => Promise<Uint8Array>,
  isCancelled: () => boolean = () => false,
): Promise<TargetSizeOutcome> => {
  const {
    targetBytes,
    minQuality = 15,
    maxQuality = 95,
    toleranceRatio = 0.03,
    maxAttempts = 7,
    timeBudgetMs = 20_000,
  } = config;

  if (!Number.isFinite(targetBytes) || targetBytes <= 0) {
    throw new EngineError('ENCODER_FAILED', 'Target size must be a positive number of bytes.');
  }
  if (minQuality >= maxQuality) {
    throw new EngineError('ENCODER_FAILED', 'Quality range is empty; minQuality must be below maxQuality.');
  }

  const started = now();
  const history: { quality: number; bytes: number }[] = [];
  const candidates: EncodeAttempt[] = [];
  let attempts = 0;

  const budgetLeft = (): boolean => now() - started < timeBudgetMs;
  const cancelled = (): void => {
    if (isCancelled()) throw new EngineError('CANCELLED', 'Target-size search cancelled.');
  };

  const fits = (attempt: EncodeAttempt): boolean => attempt.bytes.byteLength <= targetBytes;

  /** The single source of truth for "which result wins". */
  const pickBest = (): EncodeAttempt => {
    const fitting = candidates.filter(fits);
    if (fitting.length > 0) {
      return fitting.reduce((a, b) => {
        if (b.quality > a.quality) return b;
        if (b.quality === a.quality && b.bytes.byteLength > a.bytes.byteLength) return b;
        return a;
      });
    }
    return candidates.reduce((a, b) => (b.bytes.byteLength < a.bytes.byteLength ? b : a));
  };

  const encode = async (quality: number): Promise<EncodeAttempt> => {
    cancelled();
    if (!budgetLeft()) throw new EngineError('TIMEOUT', 'Target-size search exceeded its time budget.');
    if (attempts >= maxAttempts) {
      throw new EngineError('ENCODER_FAILED', 'Attempt limit reached before the search could start.');
    }
    attempts += 1;
    const q = Math.max(minQuality, Math.min(maxQuality, Math.round(quality)));
    const bytes = await encodeAt(q, attempts);
    history.push({ quality: q, bytes: bytes.byteLength });
    const attempt: EncodeAttempt = { bytes, quality: q };
    candidates.push(attempt);
    return attempt;
  };

  const describe = (): { floorBytes: number; ceilingBytes: number } => ({
    floorBytes: Math.min(...candidates.map((c) => c.bytes.byteLength)),
    ceilingBytes: Math.max(...candidates.map((c) => c.bytes.byteLength)),
  });

  // ---- Step 1: probe both ends -------------------------------------------
  const low = await encode(minQuality);
  if (fits(low) && candidates.length === 1) {
    // Fast path: only worth probing the top end if we might already be done.
  }
  const high = await encode(maxQuality);

  // ---- Step 2: non-monotonic safety probe --------------------------------
  if (!fits(low) && !fits(high) && attempts < maxAttempts) {
    const midpoint = Math.round((minQuality + maxQuality) / 2);
    if (midpoint > minQuality && midpoint < maxQuality) {
      const mid = await encode(midpoint);
      if (fits(mid)) {
        // A dip exists. Search upward from here towards maxQuality.
        return await searchUpward(mid);
      }
    }
  }

  if (fits(high)) {
    const { floorBytes, ceilingBytes } = describe();
    return {
      best: high,
      attempts,
      achieved: true,
      floorBytes,
      ceilingBytes,
      explanation:
        `Target ${formatKb(targetBytes)} is reachable even at the highest quality (${maxQuality}): ` +
        `${formatKb(high.bytes.byteLength)}. No quality reduction was needed.`,
      history,
    };
  }

  if (!fits(low)) {
    const best = pickBest();
    const { floorBytes, ceilingBytes } = describe();
    return {
      best,
      attempts,
      achieved: false,
      floorBytes,
      ceilingBytes,
      explanation:
        `Target ${formatKb(targetBytes)} is below the smallest size this encoder produced ` +
        `(${formatKb(floorBytes)} across qualities ${history.map((h) => h.quality).join(', ')}). ` +
        `Best achievable is ${formatKb(best.bytes.byteLength)} at quality ${best.quality}. ` +
        'Try a smaller output dimension or a more efficient format such as AVIF or WebP.',
      history,
    };
  }

  // ---- Step 3: binary search between a fitting low and a failing high -----
  let loQuality = minQuality; // fits
  let hiQuality = maxQuality; // does not fit
  let bestFitting = low;

  while (attempts < maxAttempts && hiQuality - loQuality > 0.5 && budgetLeft()) {
    const mid = Math.floor((loQuality + hiQuality) / 2);
    if (mid <= loQuality || mid >= hiQuality) break;

    const attempt = await encode(mid);
    if (fits(attempt)) {
      loQuality = mid;
      if (attempt.quality > bestFitting.quality) bestFitting = attempt;
      const headroom = (targetBytes - attempt.bytes.byteLength) / targetBytes;
      if (headroom <= toleranceRatio) break; // close enough; stop burning CPU
    } else {
      hiQuality = mid;
    }
  }

  const best = pickBest();
  const { floorBytes, ceilingBytes } = describe();
  const gapPct = ((targetBytes - best.bytes.byteLength) / targetBytes) * 100;
  const achieved = fits(best);

  return {
    best,
    attempts,
    achieved,
    floorBytes,
    ceilingBytes,
    explanation: achieved
      ? `Best fit: ${formatKb(best.bytes.byteLength)} at quality ${best.quality} ` +
        `(${Math.abs(gapPct).toFixed(1)}% under the ${formatKb(targetBytes)} target) ` +
        `after ${attempts} encode${attempts === 1 ? '' : 's'} — the highest quality that stayed under target. ` +
        'Exact sizes are not guaranteed.'
      : `Could not reach ${formatKb(targetBytes)} within ${attempts} attempts. ` +
        `Closest result is ${formatKb(best.bytes.byteLength)} at quality ${best.quality}.`,
    history,
  };

  /**
   * Handles the non-monotonic case: a fitting dip was found below a failing
   * ceiling, so walk upward to find the highest fitting quality.
   */
  async function searchUpward(fittingProbe: EncodeAttempt): Promise<TargetSizeOutcome> {
    let lo = fittingProbe.quality;
    let hi = maxQuality;

    while (attempts < maxAttempts && hi - lo > 0.5 && budgetLeft()) {
      const mid = Math.floor((lo + hi) / 2);
      if (mid <= lo || mid >= hi) break;
      const attempt = await encode(mid);
      if (fits(attempt)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const best = pickBest();
    const { floorBytes, ceilingBytes } = describe();
    return {
      best,
      attempts,
      achieved: fits(best),
      floorBytes,
      ceilingBytes,
      explanation:
        `This encoder is not monotonic: quality ${fittingProbe.quality} fitted the ` +
        `${formatKb(targetBytes)} target while both the lowest and highest qualities overshot. ` +
        `Searching upward found ${formatKb(best.bytes.byteLength)} at quality ${best.quality} ` +
        `after ${attempts} encodes.`,
      history,
    };
  }
};

const formatKb = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};
