import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Workspace } from '@/components/layout/AppShell';
import { CanvasColumn } from '@/components/layout/CanvasColumn';
import { CompressionPanel } from '@/components/compression/CompressionPanel';
import { CompressionStats } from '@/components/compression/CompressionStats';
import { CompressionProgress } from '@/components/compression/CompressionProgress';
import { ImagePicker, type ImagePickerHandle } from '@/components/workspace/ImagePicker';
import { useImageStore } from '@/store/imageStore';
import { useUpload, type RejectedFile } from '@/hooks/useUpload';
import { useCompression, buildOptions } from '@/hooks/useCompression';
// Options are read from the store at call time, so no component subscription is needed.
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/toastStore';
import { downloadBlob } from '@/utils/download';
import { outputFileName } from '@/engine/formats/mimeTypes';
import { errorCopy } from '@/app/constants';
import { formatBytes } from '@/utils/formatBytes';

/**
 * COMPRESSOR — the primary workspace.
 *
 * Composition only: ingest → preview/comparison → action rail → results.
 * All processing lives in the engine/worker layer; this page never touches a
 * codec directly.
 */
export const CompressorPage = () => {
  const images = useImageStore((state) => state.images);
  const activeId = useImageStore((state) => state.activeId);
  const setResult = useImageStore((state) => state.setResult);
  const setError = useImageStore((state) => state.setError);
  const removeImage = useImageStore((state) => state.removeImage);

  const { accept, busy: uploading, rejected } = useUpload();
  const pickerRef = useRef<ImagePickerHandle>(null);

  const active = useMemo(() => images.find((image) => image.id === activeId) ?? null, [images, activeId]);

  const { busy, progress, error, compress, cancel } = useCompression({
    onResult: (imageId, result) => {
      setResult(imageId, result);
      toast.success(
        'Compression complete',
        `${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)} in ${result.processingTimeMs} ms`,
      );
    },
    onError: (imageId, err) => {
      setError(imageId, err);
      const copy = errorCopy(err.code);
      toast.error(copy.title, `${err.message} ${copy.advice}`);
    },
  });

  // Surface upload rejections once per batch. React StrictMode invokes effects
  // twice in development, so we remember which batch we have already announced
  // rather than duplicating every notification.
  const announcedRejections = useRef<readonly RejectedFile[] | null>(null);
  useEffect(() => {
    if (rejected.length === 0) return;
    if (announcedRejections.current === rejected) return;
    announcedRejections.current = rejected;
    for (const item of rejected) {
      const copy = errorCopy(item.code);
      toast.error(`${item.name}: ${copy.title}`, item.message);
    }
  }, [rejected]);

  const handleCompress = useCallback(() => {
    if (!active) return;
    // No resize options are ever produced: buildOptions maps only quality,
    // format, mode, effort and metadata, so output size always equals source.
    void compress(active, buildOptions(useSettingsStore.getState(), active));
  }, [active, compress]);

  const handleDownload = useCallback(() => {
    if (!active?.result) return;
    try {
      downloadBlob(active.result.blob, outputFileName(active.name, active.result.format));
      toast.success('Download started', outputFileName(active.name, active.result.format));
    } catch (err) {
      toast.error('Download failed', err instanceof Error ? err.message : 'The browser blocked the download.');
    }
  }, [active]);

  // Ctrl/Cmd+Enter compresses the current image — a real shortcut, not decoration.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!busy) handleCompress();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, handleCompress]);

  return (
    <>
      <ImagePicker ref={pickerRef} onFile={(file) => void accept([file])} />
      <Workspace
        main={
          <CanvasColumn
            image={active}
            uploading={uploading}
            onBrowse={() => pickerRef.current?.open()}
            onFile={(file) => void accept([file])}
            onRemove={() => active && removeImage(active.id)}
            emptyTitle="Compress an image"
            status={
              <>
                <CompressionProgress progress={progress} done={!busy && !error} />

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2"
                  >
                    <TriangleAlert className="mt-px size-3.5 shrink-0 text-danger" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-danger">{errorCopy(error.code).title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-dim">{error.message}</p>
                      <p className="mt-0.5 text-[10.5px] text-ink-muted">{errorCopy(error.code).advice}</p>
                    </div>
                  </div>
                )}

                {active?.result && !busy && <CompressionStats
                  result={active.result}
                  fileName={outputFileName(active.name, active.result.format)}
                />}

                {active?.error && !busy && (
                  <div className="flex items-center gap-2 rounded-md border border-danger/25 bg-danger/[0.05] px-3 py-1.5 text-[11.5px] text-danger">
                    <TriangleAlert className="size-3 shrink-0" aria-hidden />
                    {active.error.message}
                    <button
                      type="button"
                      onClick={() => setError(active.id, undefined)}
                      className="ml-auto rounded-xs p-0.5 text-ink-muted hover:text-ink"
                      aria-label="Dismiss error"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                )}
              </>
            }
          />
        }
        aside={active ? (
          <CompressionPanel
            image={active}
            busy={busy}
            onCompress={handleCompress}
            onCancel={cancel}
            onDownload={handleDownload}
            onAnother={() => pickerRef.current?.open()}
          />
        ) : undefined}
      />
    </>
  );
};
