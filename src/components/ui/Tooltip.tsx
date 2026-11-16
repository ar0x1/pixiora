import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Tooltip, shown on hover AND keyboard focus (so it is not mouse-only).
 * Wired with aria-describedby rather than aria-label so the trigger's
 * accessible name is never overwritten.
 */
export const Tooltip = ({ content, children, side = 'top', className }: TooltipProps) => {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute left-1/2 z-40 w-max max-w-[240px] -translate-x-1/2',
            'rounded-sm border border-line-strong bg-elevated px-2 py-1 text-[11px] leading-snug text-ink-dim',
            'shadow-pop animate-[tooltipIn_100ms_ease-out]',
            side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
};
