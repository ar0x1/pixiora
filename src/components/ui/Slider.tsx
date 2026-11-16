import { useId } from 'react';
import { cn } from '@/utils/cn';

export interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** Rendered after the value, e.g. "%" or " KB". */
  unit?: string;
  hint?: string;
  disabled?: boolean;
  /** Marks the track at a meaningful spot. */
  marker?: number;
  formatValue?: (value: number) => string;
}

/**
 * Range input.
 *
 * Native <input type=range> keeps arrow-key / Home / End support and correct
 * screen-reader semantics. The visuals are a 2px track with a square thumb, so
 * it reads as an instrument control rather than a toy.
 */
export const Slider = ({
  label,
  value,
  min = 1,
  max = 100,
  step = 1,
  onChange,
  unit = '',
  hint,
  disabled = false,
  marker,
  formatValue,
}: SliderProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const percent = ((value - min) / (max - min)) * 100;
  const markerPercent = marker !== undefined ? ((marker - min) / (max - min)) * 100 : null;

  return (
    <div className="select-none">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="eyebrow">
          {label}
        </label>
        <output
          htmlFor={id}
          className="tabular rounded-xs border border-line bg-white/[0.04] px-1.5 py-0.5 text-[11.5px] font-medium text-ink"
        >
          {formatValue ? formatValue(value) : value}
          {unit}
        </output>
      </div>

      <div className={cn('relative flex h-4 items-center', disabled && 'opacity-50')}>
        <div className="pointer-events-none absolute inset-x-0 h-[3px] rounded-xs bg-white/[0.09]">
          <div
            className="h-full rounded-xs bg-accent-soft transition-[width] duration-75"
            style={{ width: `${percent}%` }}
          />
        </div>
        {markerPercent !== null && (
          <div
            className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/45"
            style={{ left: `${markerPercent}%` }}
            aria-hidden
          />
        )}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-describedby={hint ? hintId : undefined}
          aria-valuetext={`${formatValue ? formatValue(value) : value}${unit}`}
          className={cn(
            'relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent',
            '[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:rounded-[2px] [&::-webkit-slider-thumb]:border',
            '[&::-webkit-slider-thumb]:border-white/70 [&::-webkit-slider-thumb]:bg-accent-soft',
            '[&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110',
            '[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-[2px]',
            '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/70 [&::-moz-range-thumb]:bg-accent-soft',
            'disabled:cursor-not-allowed',
          )}
        />
      </div>

      {hint && (
        <p id={hintId} className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
};
