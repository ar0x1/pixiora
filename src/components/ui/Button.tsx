import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

/**
 * Button.
 *
 * Slightly rounded (7–9px per the design system), a single hairline edge, and a
 * 1px "press" inset instead of a drop shadow. The primary variant is the only
 * saturated surface in the UI, which is what makes it read as *the* action.
 * Typography is DM Sans at 12.5–13px — buttons never inherit the display serif.
 */
const variants: Record<Variant, string> = {
  primary: cn(
    'bg-accent-strong text-white',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
    'hover:bg-[#1b4fba] active:bg-[#17449f]',
    'disabled:bg-[#16233a] disabled:text-ink-muted disabled:shadow-none',
  ),
  secondary: cn(
    'bg-raised text-ink border border-line-strong',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
    'hover:bg-elevated hover:border-white/20 active:bg-[#12161d]',
    'disabled:bg-surface disabled:text-ink-muted disabled:border-line',
  ),
  ghost: 'text-ink-dim hover:bg-white/[0.06] hover:text-ink disabled:text-ink-muted/60',
  danger: cn(
    'bg-danger/90 text-white hover:bg-danger active:bg-danger/80',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] disabled:bg-danger/25 disabled:text-white/60 disabled:shadow-none',
  ),
  subtle: cn(
    'bg-white/[0.04] text-ink-dim border border-line',
    'hover:bg-white/[0.07] hover:text-ink hover:border-line-strong',
    'disabled:text-ink-muted/70',
  ),
};

const sizes: Record<Size, string> = {
  xs: 'h-6 px-2 text-[11px] gap-1 rounded-xs',
  sm: 'h-7.5 px-2.5 text-[12px] gap-1.5 rounded-sm',
  md: 'h-8.5 px-3 text-[12.5px] gap-1.5 rounded-sm',
  lg: 'h-10 px-4 text-[13px] gap-2 rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, iconRight, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-[background-color,border-color,color,box-shadow] duration-100',
        'disabled:cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-soft',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

/** Square icon-only button. `label` becomes the accessible name and tooltip. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'children' | 'icon' | 'iconRight' | 'fullWidth'> & { label: string; children: ReactNode }
>(function IconButton({ label, children, size = 'md', className, ...rest }, ref) {
  const square = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-9' : size === 'xs' ? 'size-6' : 'size-8';
  return (
    <Button
      ref={ref}
      aria-label={label}
      title={label}
      size={size}
      className={cn('px-0', square, className)}
      {...rest}
    >
      {children}
    </Button>
  );
});
