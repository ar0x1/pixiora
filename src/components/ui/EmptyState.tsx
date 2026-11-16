import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty canvas.
 *
 * Centred, but deliberately quiet: a hairline icon tile, one line of copy and a
 * single action. Never a marketing block — an empty workspace is still a
 * workspace.
 */
export const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
    <div
      className="mb-4 flex size-10 items-center justify-center rounded-md border border-line bg-white/[0.025] text-ink-muted shadow-inset"
      aria-hidden
    >
      {icon}
    </div>
    <h3 className="text-[13.5px] font-medium tracking-tight text-ink">{title}</h3>
    <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-ink-muted">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
