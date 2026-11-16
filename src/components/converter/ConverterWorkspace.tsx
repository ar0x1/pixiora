import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Repeat2, TriangleAlert } from 'lucide-react';
import { Workspace } from '@/components/layout/AppShell';
import { CanvasColumn } from '@/components/layout/CanvasColumn';
import { ConversionOptions } from '@/components/converter/ConversionOptions';
import { CompressionStats } from '@/components/compression/CompressionStats';
import { CompressionProgress } from '@/components/compression/CompressionProgress';
import { ImagePicker, type ImagePickerHandle } from '@/components/workspace/ImagePicker';
import { Button } from '@/components/ui/Button';
import { PanelHeader } from '@/components/ui/Primitives';
import { useImageStore } from '@/store/imageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUpload, type RejectedFile } from '@/hooks/useUpload';
import { useCompression, buildOptions } from '@/hooks/useCompression';
import { defaultOutputFormat } from '@/engine/formats/formatMapping';
import { canConvert } from '@/engine/formats/formatCapabilities';
import { outputFileName } from '@/engine/formats/mimeTypes';
import { downloadBlob } from '@/utils/download';
import { toast } from '@/store/toastStore';
import { errorCopy } from '@/app/constants';
import type { OutputFormat } from '@/types/image';

/**
 * CONVERTER — format-to-format work with explicit capability reporting.
 *
 * The target defaults to a sensible web equivalent for the source and invalid
 * pairs cannot be selected. Like every workspace it holds exactly one image, so
 * the rail always describes the file on screen.
 */
export const ConverterWorkspace = () => {
  const images = useImageStore((state) => state.images);
  const activeId = useImageStore((state) => state.activeId);
  const setResult = useImageStore((state) => state.setResult);
  const setError = useImageStore((state) => state.setError);
  const removeImage = useImageStore((state) => state.removeImage);
  const resetResult = useImageStore((state) => state.resetResult);
  // Conversion reads the stored settings at call time via getState();
  // no component-level subscription is needed.
  const { accept, busy: uploading, rejected } = useUpload();
  const pickerRef = useRef<ImagePickerHandle>(null);

  const active = useMemo(() => images.find((image) => image.id === activeId) ?? null, [images, activeId]);
  const [target, setTarget] = useState<OutputFormat>('webp');

  // Keep the target valid whenever the selection changes.
  useEffect(() => {
    if (!active) return;
    const fallback = defaultOutputFormat(active.descriptor.format);
    if (!canConvert(active.descriptor.format, target)) setTarget(fallback);
  }, [active, target]);

  // Surface upload rejections once per batch (same contract as the Compressor).
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

  const { busy, progress, error, compress } = useCompression({
    onResult: (imageId, result) => {
      setResult(imageId, result);
      toast.success('Conversion complete', `Saved as ${result.format.toUpperCase()} (${result.width}×${result.height}).`);
    },
    onError: (imageId, err) => setError(imageId, err),
  });

  // Changing the target invalidates the previous output: the stats strip must
  // never describe a format the user is no longer asking for.
  const chooseTarget = useCallback(
    (format: OutputFormat) => {
      setTarget(format);
      if (active?.result && active.result.format !== format) resetResult(active.id);
    },
    [active, resetResult],
  );

  const convert = useCallback(() => {
    if (!active) return;
    const options = { ...buildOptions(useSettingsStore.getState(), active), format: target };
    void compress(active, options);
  }, [active, compress, target]);

  const download = useCallback(() => {
    if (!active?.result) return;
    downloadBlob(active.result.blob, outputFileName(active.name, active.result.format));
  }, [active]);

  const converted = Boolean(active?.result) && !busy;

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
            emptyTitle="Convert an image"
            status={
              <>
                <CompressionProgress progress={progress} done={!busy && !error} />
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2 text-[11.5px] text-ink-dim"
                  >
                    <TriangleAlert className="mt-px size-3.5 shrink-0 text-danger" aria-hidden />
                    {error.message}
                  </div>
                )}
                {converted && active?.result && <CompressionStats
                  result={active.result}
                  fileName={outputFileName(active.name, active.result.format)}
                />}
              </>
            }
          />
        }
        aside={active ? (
          <div className="panel overflow-hidden">
            <PanelHeader label="Conversion" icon={<Repeat2 className="size-3 text-ink-muted" aria-hidden />} />

            <div className="flex flex-col gap-2.5 p-2.5">
              {active && (
                <>
                  <ConversionOptions
                    sourceFormat={active.descriptor.format}
                    targetFormat={target}
                    onTargetChange={chooseTarget}
                    hasAlpha={active.hasAlpha}
                    isAnimated={active.isAnimated}
                  />

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={converted ? () => pickerRef.current?.open() : convert}
                    loading={busy}
                    disabled={!canConvert(active.descriptor.format, target)}
                    icon={<Repeat2 className="size-3.5" aria-hidden />}
                  >
                    {converted ? `Convert to ${target.toUpperCase()} again` : `Convert to ${target.toUpperCase()}`}
                  </Button>

                  <Button
                    variant="secondary"
                    fullWidth
                    disabled={!active.result}
                    onClick={download}
                    icon={<Download className="size-3.5" aria-hidden />}
                  >
                    Download
                  </Button>

                </>
              )}
            </div>
          </div>
        ) : undefined}
      />
    </>
  );
};
