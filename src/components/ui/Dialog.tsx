import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible modal.
 *
 * Implements what the platform gives us for free plus what it does not:
 * role=dialog + aria-modal, focus trap, Escape to close, scroll lock, focus
 * restoration, and click-outside dismissal. No external a11y dependency.
 */
export const Dialog = ({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Deliberately keyed on `open` only: a changing callback identity must not
  // re-run the focus trap and yank focus back to the first control.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((node) => !node.hasAttribute('disabled'));
      if (nodes.length === 0) return;
      const first = nodes[0] as HTMLElement;
      const last = nodes[nodes.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-[fadeIn_120ms_ease-out] bg-black/75" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pixiora-dialog-title"
        aria-describedby={description ? 'pixiora-dialog-description' : undefined}
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-lg border border-line-strong bg-surface shadow-pop',
          'animate-[dialogIn_150ms_ease-out]',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-3xl',
        )}
      >
        <div className="panel-header py-2.5">
          <div className="min-w-0">
            <h2 id="pixiora-dialog-title" className="text-[13px] font-medium tracking-tight text-ink">
              {title}
            </h2>
            {description && (
              <p id="pixiora-dialog-description" className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded-xs p-1.5 text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-4 py-3.5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line bg-base/60 px-4 py-2.5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};
