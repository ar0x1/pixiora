import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
  /** Explains *why* an option is unavailable (shown in the option list). */
  readonly disabledReason?: string;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}

/**
 * Native <select>, styled to sit flush inside a field row.
 * The native control is accessible and keyboard-correct for free; only the
 * paint is custom.
 */
export const Select = <T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  disabled,
  hideLabel,
}: SelectProps<T>) => {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={cn('eyebrow mb-2 block', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as T)}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            'h-8 w-full appearance-none rounded-sm border border-line-strong bg-raised pl-2.5 pr-8',
            'text-[12.5px] text-ink transition-colors hover:border-white/20',
            'focus-visible:border-accent-soft disabled:cursor-not-allowed disabled:text-ink-muted',
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
              {option.disabled && option.disabledReason ? ` — ${option.disabledReason}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
          aria-hidden
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
