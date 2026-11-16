import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface DropdownItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly onSelect: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
}

export interface DropdownProps {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  items: readonly DropdownItem[];
  align?: 'left' | 'right';
}

/**
 * Menu-style dropdown with correct keyboard semantics: Escape closes,
 * ArrowUp/ArrowDown move focus, click-outside dismisses, and focus returns
 * to the trigger afterwards.
 */
export const Dropdown = ({ trigger, items, align = 'right' }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.querySelector<HTMLElement>('button')?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
      if (nodes.length === 0) return;
      const index = nodes.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'ArrowDown'
        ? nodes[(index + 1 + nodes.length) % nodes.length]
        : nodes[(index - 1 + nodes.length) % nodes.length];
      next?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div ref={triggerRef}>{trigger({ open, toggle: () => setOpen((v) => !v), id: `${id}-trigger` })}</div>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-labelledby={`${id}-trigger`}
          className={cn(
            'absolute z-40 mt-1 min-w-[180px] overflow-hidden rounded-md border border-line-strong bg-elevated p-1 shadow-pop',
            'animate-[menuIn_120ms_ease-out]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-[12px] transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-45',
                item.danger ? 'text-danger hover:bg-danger/10' : 'text-ink-dim hover:bg-white/[0.06] hover:text-ink',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
