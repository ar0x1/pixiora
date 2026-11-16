import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompressionMode, CompressionOptions } from '@/types/compression';
import type { OutputFormat } from '@/types/image';

/**
 * Settings store — user preferences, persisted to localStorage.
 *
 * Privacy note: only *settings* are persisted (format, quality, toggles). No
 * image data, no filenames, no file contents ever touch localStorage.
 */

export interface SettingsState {
  mode: CompressionMode;
  format: OutputFormat | 'auto';
  /** Locked at 50 — kept in state so the pipeline contract is unchanged. */
  quality: number;
  targetSizeValue: string;
  targetSizeUnit: 'KB' | 'MB';
  lossless: boolean;
  effort: number;
  avifSpeed: number;
  stripMetadata: boolean;
  preserveTransparency: boolean;
  reducedMotion: boolean;
  setMode: (mode: CompressionMode) => void;
  setFormat: (format: OutputFormat | 'auto') => void;
  setTargetSize: (value: string, unit?: 'KB' | 'MB') => void;
  setLossless: (lossless: boolean) => void;
  setAvifSpeed: (speed: number) => void;
  setStripMetadata: (strip: boolean) => void;
  setPreserveTransparency: (preserve: boolean) => void;
}

const defaults = {
  mode: 'smart' as CompressionMode,
  format: 'auto' as OutputFormat | 'auto', // 'auto' resolves per image at call time
  // Locked: quality is not user-adjustable. 60 keeps output smaller than source.
  quality: 50,
  targetSizeValue: '250',
  targetSizeUnit: 'KB' as 'KB' | 'MB',
  lossless: false,
  // Locked to the maximum compression effort (slowest, smallest lossless output).
  effort: 6,
  avifSpeed: 6,
  stripMetadata: true,
  preserveTransparency: true,
  reducedMotion: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setMode: (mode) => set({ mode }),
      setFormat: (format) => set({ format }),
      setTargetSize: (value, unit) =>
        set((state) => ({ targetSizeValue: value, targetSizeUnit: unit ?? state.targetSizeUnit })),
      setLossless: (lossless) => set({ lossless }),
      setAvifSpeed: (avifSpeed) => set({ avifSpeed: Math.min(10, Math.max(0, Math.round(avifSpeed))) }),
      setStripMetadata: (stripMetadata) => set({ stripMetadata }),
      setPreserveTransparency: (preserveTransparency) => set({ preserveTransparency }),
    }),
    {
      name: 'pixiora-settings-v1', // settings only, never image data
      version: 2,
      // Locked values always win: a blob persisted by the old Settings sliders
      // must not restore a lower quality or a cheaper effort.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        return { ...state, quality: 50, effort: 6 } as never;
      },
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        quality: 50,
        effort: 6,
      }),
      partialize: (state) => ({
        mode: state.mode,
        format: state.format,
        quality: state.quality,
        targetSizeValue: state.targetSizeValue,
        targetSizeUnit: state.targetSizeUnit,
        lossless: state.lossless,
        effort: state.effort,
        avifSpeed: state.avifSpeed,
        stripMetadata: state.stripMetadata,
        preserveTransparency: state.preserveTransparency,
        reducedMotion: state.reducedMotion,
      }),
    },
  ),
);

export { defaults as defaultSettings };
export type { CompressionOptions };
