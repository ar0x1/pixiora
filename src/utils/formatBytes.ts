/** Byte formatting with honest precision (never rounds 1.04 KB down to "1 KB"). */
export const formatBytes = (bytes: number, decimals = 1): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const unit = units[unitIndex] as string;
  const precision = value >= 100 ? 0 : decimals;
  return `${value.toFixed(precision)} ${unit}`;
};

/** Parse a user-entered size ("250 KB", "1.5mb", "800") into bytes. */
export const parseSizeToBytes = (input: string, fallbackUnit: 'KB' | 'MB' = 'KB'): number | null => {
  const match = /^\s*([\d.]+)\s*(b|kb|mb|gb)?\s*$/i.exec(input);
  if (!match) return null;
  const value = Number.parseFloat(match[1] as string);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] ?? fallbackUnit).toUpperCase();
  const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return Math.round(value * (multipliers[unit] ?? 1024));
};
