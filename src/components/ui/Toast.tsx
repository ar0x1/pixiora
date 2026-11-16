import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastTone } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const toneStyles: Record<ToastTone, { icon: typeof Info; bar: string; text: string }> = {
  info: { icon: Info, bar: 'bg-white/25', text: 'text-ink' },
  success: { icon: CheckCircle2, bar: 'bg-ok', text: 'text-ok' },
  warning: { icon: AlertTriangle, bar: 'bg-warn', text: 'text-warn' },
  error: { icon: XCircle, bar: 'bg-danger', text: 'text-danger' },
};

/**
 * Notification stack.
 *
 * Top-right on desktop (out of the way of the action rail's bottom edge),
 * bottom on mobile above the tab bar. Tone is carried by a 2px left rule plus an
 * icon, never by colour alone. aria-live="polite"; errors escalate to alert.
 */
export const ToastStack = () => {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex flex-col items-center gap-2 p-3 md:flex-col-reverse md:inset-x-auto md:bottom-auto md:right-2.5 md:top-2.5 md:items-end"
    >
      {toasts.map((item) => {
        const tone = toneStyles[item.tone];
        const Icon = tone.icon;
        return (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto relative flex w-full max-w-[320px] items-start gap-2 overflow-hidden rounded-md border border-line-strong bg-elevated py-2 pl-3 pr-1.5',
              'shadow-pop animate-[toastIn_160ms_ease-out]',
            )}
          >
            <span className={cn('absolute inset-y-0 left-0 w-[2px]', tone.bar)} aria-hidden />
            <Icon className={cn('mt-px size-3.5 shrink-0', tone.text)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[12px] font-medium leading-tight', tone.text)}>{item.title}</p>
              {item.description && (
                <p className="mt-0.5 tabular text-[11px] leading-snug text-ink-muted">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={`Dismiss notification: ${item.title}`}
              className="rounded-xs p-1 text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
};
