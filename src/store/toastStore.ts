import { create } from 'zustand';

/** Transient notifications. Toasts are announcements too (aria-live). */
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  readonly id: string;
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: string;
  /** Milliseconds; 0 keeps it until dismissed. */
  readonly duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast_${(seq += 1)}`;
    const duration = toast.duration ?? (toast.tone === 'error' ? 8000 : 4500);
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { ...toast, id, duration }],
    }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Convenience accessor usable outside React (workers, error paths). */
export const toast = {
  info: (title: string, description?: string) => useToastStore.getState().push({ tone: 'info', title, description }),
  success: (title: string, description?: string) => useToastStore.getState().push({ tone: 'success', title, description }),
  warning: (title: string, description?: string) => useToastStore.getState().push({ tone: 'warning', title, description }),
  error: (title: string, description?: string) => useToastStore.getState().push({ tone: 'error', title, description }),
};
