import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompressionOptions, CompressionResult, PhaseProgress } from '@/types/compression';
import type { PixioraImage } from '@/store/imageStore';
import { workerManager } from '@/engine/workers/workerManager';
import { defaultOutputFormat } from '@/engine/formats/formatMapping';
import { parseSizeToBytes } from '@/utils/formatBytes';
import type { SettingsState } from '@/store/settingsStore';

/**
 * Single-image compression hook.
 *
 * Owns the lifecycle of one job: build options → submit → track phase → write
 * results into the image store. Cancellation is wired through to the worker.
 * The previous result is kept until a new job succeeds, so the UI never blanks.
 */

export interface UseCompressionResult {
  readonly busy: boolean;
  readonly progress: PhaseProgress | null;
  readonly error: { code: string; message: string } | null;
  readonly compress: (image: PixioraImage, options: CompressionOptions) => Promise<CompressionResult | null>;
  readonly cancel: () => void;
  readonly clearError: () => void;
}

interface UseCompressionArgs {
  readonly onResult?: (imageId: string, result: CompressionResult) => void;
  readonly onError?: (imageId: string, error: { code: string; message: string }) => void;
}

let jobSeq = 0;
const nextJobId = (): string => `job_${Date.now().toString(36)}_${(jobSeq += 1).toString(36)}`;

export const useCompression = ({ onResult, onError }: UseCompressionArgs = {}): UseCompressionResult => {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PhaseProgress | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const activeJob = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (activeJob.current) workerManager.cancel(activeJob.current);
    };
  }, []);

  const compress = useCallback(
    (image: PixioraImage, options: CompressionOptions): Promise<CompressionResult | null> =>
      new Promise((resolve) => {
        const jobId = nextJobId();
        activeJob.current = jobId;
        setBusy(true);
        setError(null);
        setProgress({ phase: 'queued' });

        // The worker transfers the buffer, so hand it a copy to keep retries safe.
        const buffer = image.fileBytes.slice(0);

        workerManager.submit(
          {
            jobId,
            buffer,
            fileName: image.name,
            declaredMime: image.descriptor.mimeType,
            options,
          },
          {
            onProgress: (_id, phase) => {
              if (mounted.current && activeJob.current === jobId) setProgress(phase);
            },
            onSuccess: (_id, result) => {
              if (!mounted.current) return;
              activeJob.current = null;
              setBusy(false);
              setProgress({ phase: 'finalizing' });
              onResult?.(image.id, result);
              resolve(result);
            },
            onError: (_id, err) => {
              if (!mounted.current) return;
              activeJob.current = null;
              setBusy(false);
              setError({ code: err.code, message: err.message });
              onError?.(image.id, { code: err.code, message: err.message });
              resolve(null);
            },
            onCancelled: () => {
              if (!mounted.current) return;
              activeJob.current = null;
              setBusy(false);
              setProgress(null);
              resolve(null);
            },
          },
        );
      }),
    [onError, onResult],
  );

  /**
   * Cancel.
   *
   * The UI state is cleared here rather than waiting for the worker's
   * `onCancelled` round-trip: the pool terminates the worker, so no message may
   * ever come back from it, and a spinner that hangs because a dead worker never
   * replied is exactly the bug this replaces.
   */
  const cancel = useCallback(() => {
    const jobId = activeJob.current;
    if (jobId) workerManager.cancel(jobId);
    activeJob.current = null;
    setBusy(false);
    setProgress(null);
  }, []);

  return { busy, progress, error, compress, cancel, clearError: () => setError(null) };
};

/**
 * Translate the settings UI state into engine options for one specific image.
 * This is the ONLY place that knows how UI knobs map to engine options.
 *
 * PIXIORA has no resize feature: no dimension is ever constrained here, so the
 * engine's `planResize` always resolves to the source size. The resampling code
 * survives only as the progressive-downscale helper codecs use internally; it
 * is not reachable from any UI control.
 */
export const buildOptions = (settings: SettingsState, image: PixioraImage): CompressionOptions => {
  const format = settings.format === 'auto' ? defaultOutputFormat(image.descriptor.format) : settings.format;
  const overrides = image.overrides ?? {};

  const targetBytes =
    settings.mode === 'target-size'
      ? (parseSizeToBytes(settings.targetSizeValue, settings.targetSizeUnit) ?? undefined)
      : undefined;

  return {
    quality: settings.quality,
    format,
    mode: settings.mode,
    targetSizeBytes: targetBytes,
    preserveTransparency: settings.preserveTransparency,
    stripMetadata: settings.stripMetadata,
    lossless: settings.lossless,
    effort: settings.effort,
    avifSpeed: settings.avifSpeed,
    ...overrides,
  };
};

