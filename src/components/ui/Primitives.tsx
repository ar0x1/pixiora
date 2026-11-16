import type { ReactNode } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

/* ==========================================================================
   Layout primitives shared by every workspace.
   These exist so the three sections cannot drift apart visually: a panel
   header, a control group and a stat readout are identical everywhere.
   ========================================================================== */

export interface PanelHeaderProps {
  label: string;
  icon?: ReactNode;
  /** Right-hand slot: a chip, a meta value, an icon button. */
  meta?: ReactNode;
}

/**
 * Hairline header strip for a panel. One per panel, never two.
 *
 * The label is set in the display serif — it makes every panel read as a
 * titled card rather than a toolbar, which is the whole point of the reference
 * system's card language.
 */
export const PanelHeader = ({ label, icon, meta }: PanelHeaderProps) => (
  <div className="panel-header">
    <h2 className="display-sm flex items-center gap-2 text-[15.5px]">
      {icon}
      {label}
    </h2>
    {meta && <div className="flex shrink-0 items-center gap-1.5">{meta}</div>}
  </div>
);

/** Small neutral chip. Used for formats, counts and origins. */
export const Chip = ({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'warn';
  title?: string;
}) => (
  <span
    title={title}
    className={cn(
      'inline-flex h-[18px] shrink-0 items-center rounded-xs border px-1.5 text-[10px] font-medium uppercase tracking-wide',
      tone === 'neutral' && 'border-line-strong bg-white/[0.04] text-ink-dim',
      tone === 'accent' && 'border-accent/40 bg-accent/15 text-accent-soft',
      tone === 'ok' && 'border-ok/30 bg-ok/10 text-ok',
      tone === 'warn' && 'border-warn/30 bg-warn/10 text-warn',
    )}
  >
    {children}
  </span>
);

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * Segmented control.
 *
 * A radiogroup of flat buttons in a pressed-in track. Used for mutually
 * exclusive choices that must stay visible (resize unit, comparison mode) —
 * not for navigation, which the header owns.
 */
export const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="flex gap-px rounded-sm border border-line bg-black/30 p-px"
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex h-6 flex-1 items-center justify-center gap-1 rounded-xs px-1.5 text-[11px] transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-soft',
            active ? 'bg-white/[0.09] font-medium text-ink' : 'text-ink-muted hover:text-ink-dim',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      );
    })}
  </div>
);

/** Label + value row used in stat strips. */
export const StatCell = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="min-w-0 flex-1 px-3 py-2">
    <dt className="eyebrow">{label}</dt>
    <dd className={cn('tabular mt-0.5 truncate text-[12.5px]', accent ? 'text-ink' : 'text-ink-dim')}>{value}</dd>
  </div>
);

/**
 * Completion state.
 *
 * Appears only once an operation has actually finished, and carries the one
 * action a finished workspace needs: start over with a different image. It is
 * the only place a new image can be introduced, so "one image at a time" is a
 * rule of the layout rather than a rule the user has to remember.
 */
export const NextImageAction = ({
  title,
  detail,
  label,
  onSelect,
}: {
  title: string;
  detail: string;
  label: string;
  onSelect: () => void;
}) => (
  <div className="well flex flex-col gap-2 p-3">
    <div className="flex items-start gap-2">
      <span className="mt-[1px] flex size-[18px] shrink-0 items-center justify-center rounded-full bg-ok/12 text-ok">
        <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium leading-tight text-ink">{title}</p>
        <p className="tabular mt-0.5 truncate text-[11px] text-ink-muted">{detail}</p>
      </div>
    </div>

    <Button
      variant="secondary"
      size="md"
      fullWidth
      onClick={onSelect}
      icon={<RotateCcw className="size-3.5" aria-hidden />}
    >
      {label}
    </Button>
  </div>
);
