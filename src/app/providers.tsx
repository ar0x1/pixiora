import { useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { workerManager } from '@/engine/workers/workerManager';
import { configureLimits, DEFAULT_LIMITS } from '@/engine/core/limits';
import { revokeAllObjectUrls } from '@/utils/objectUrl';

/** Optional runtime overrides supplied at build time (documented in README). */
const MAX_FILE_MB = Number(import.meta.env.VITE_PIXIORA_MAX_FILE_MB ?? '');
const MAX_PIXELS_MP = Number(import.meta.env.VITE_PIXIORA_MAX_PIXELS_MP ?? '');

/**
 * App-wide lifecycle wiring.
 *
 * - Applies configured engine limits before any job can run.
 * - Disposes the worker pool and revokes every outstanding object URL on unload,
 *   so a closed tab never leaves orphaned memory behind.
 */
export const AppProviders = ({ children }: { children: ReactNode }) => {
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  // Honour the in-app preference the same way we honour the OS setting, by
  // shrinking animation durations at the root rather than per component.
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
  }, [reducedMotion]);

  useEffect(() => {
    if (Number.isFinite(MAX_FILE_MB) && MAX_FILE_MB > 0) {
      configureLimits({ maxFileBytes: MAX_FILE_MB * 1024 * 1024 });
    }
    if (Number.isFinite(MAX_PIXELS_MP) && MAX_PIXELS_MP > 0) {
      configureLimits({ maxPixels: MAX_PIXELS_MP * 1_000_000 });
    }

    const onUnload = () => {
      revokeAllObjectUrls();
      workerManager.dispose();
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      window.removeEventListener('pagehide', onUnload);
    };
  }, []);

  useEffect(() => {
    // Surface the effective limits for diagnostics without leaking anything.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[PIXIORA] limits', DEFAULT_LIMITS);
    }
  }, []);

  return <>{children}</>;
};
