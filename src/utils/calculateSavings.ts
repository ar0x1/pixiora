import type { Savings } from '@/types/compression';

/**
 * Savings maths. Negative results are returned as-is: if the optimised file is
 * bigger we say so (grew: true) instead of hiding it — that happens legitimately
 * when converting an already-optimised JPEG to PNG, for example.
 */
export const calculateSavings = (originalSize: number, compressedSize: number): Savings => {
  if (!Number.isFinite(originalSize) || originalSize <= 0) {
    return { bytes: 0, percent: 0, grew: false };
  }
  const bytes = originalSize - compressedSize;
  const percent = (bytes / originalSize) * 100;
  return { bytes, percent, grew: bytes < 0 };
};

/** Total savings across many results, weighted by original size (not an average of averages). */
export const calculateTotalSavings = (
  rows: readonly { originalSize: number; compressedSize: number }[],
): Savings => {
  const original = rows.reduce((sum, r) => sum + r.originalSize, 0);
  const compressed = rows.reduce((sum, r) => sum + r.compressedSize, 0);
  return calculateSavings(original, compressed);
};
