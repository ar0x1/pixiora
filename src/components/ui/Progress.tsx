import { cn } from '@/utils/cn';

export interface ProgressProps {
  /** 0–100. Omit for an indeterminate bar (used only when no real value exists). */
  value?: number;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Progress bar. Determinate when a real number exists; indeterminate otherwise.
 * Indeterminate is never used to fake a percentage — it communicates "working",
 * with the actual phase text rendered beside it by callers.
 */
export const Progress = ({ value, label, className, size = 'md' }: ProgressProps) => {
  const determinate = typeof value === 'number' && Number.isFinite(value);
  const clamped = determinate ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-xs bg-white/[0.09]', size === 'sm' ? 'h-[3px]' : 'h-1', className)}
      role="progressbar"
      aria-label={label ?? 'Progress'}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(clamped) : undefined}
      aria-valuetext={determinate ? `${Math.round(clamped)}%` : 'In progress'}
    >
      {determinate ? (
        <div
          className="h-full rounded-xs bg-accent-soft transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      ) : (
        <div className="indeterminate h-full w-1/4 rounded-xs bg-accent-soft/80" />
      )}
    </div>
  );
};
