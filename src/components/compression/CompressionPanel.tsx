import { Download, TriangleAlert, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip, PanelHeader } from '@/components/ui/Primitives';
import { useSettingsStore } from '@/store/settingsStore';
import type { PixioraImage } from '@/store/imageStore';
import { defaultOutputFormat } from '@/engine/formats/formatMapping';
import { ENCODERS, animationWarning, transparencyWarning } from '@/engine/formats/formatCapabilities';

export interface CompressionPanelProps {
  image: PixioraImage | null;
  busy: boolean;
  onCompress: () => void;
  onCancel: () => void;
  onDownload: () => void;
  /** Second run: choose a new image rather than re-running this one. */
  onAnother: () => void;
}

/**
 * The Compressor's action rail: compress, or download what was compressed.
 *
 * There are deliberately no settings here. Every option (quality, format, mode,
 * effort, metadata) is resolved automatically by the engine from the image
 * itself. The panel's only job is to run the job and report what it produced —
 * no completion card, no "compress another image" block. Loading a different
 * image is the toolbar's close button, one click away.
 */
export const CompressionPanel = ({ image, busy, onCompress, onCancel, onDownload, onAnother }: CompressionPanelProps) => {
  const settings = useSettingsStore();
  const sourceFormat = image?.descriptor.format ?? null;
  const target = sourceFormat
    ? settings.format === 'auto'
      ? defaultOutputFormat(sourceFormat)
      : settings.format
    : null;

  const encoder = target ? ENCODERS[target] : null;

  // Only warnings that change what you get are surfaced; there are no controls.
  const warnings = image && target
    ? [animationWarning(image.isAnimated, target), transparencyWarning(image.hasAlpha, target)].filter(
        (warning): warning is string => Boolean(warning),
      )
    : [];

  const result = image?.result ?? null;

  return (
    <div className="panel overflow-hidden">
      <PanelHeader
        label="Compression"
        icon={<Zap className="size-3 text-ink-muted" aria-hidden />}
        meta={encoder && <Chip title={encoder.provider}>{encoder.label}</Chip>}
      />

      <div className="flex flex-col gap-3 p-3">
        {warnings.length > 0 && (
          <ul className="flex flex-col gap-1">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="flex items-start gap-1.5 rounded-sm border border-warn/25 bg-warn/[0.07] px-3 py-2.5 text-[11px] leading-snug text-warn"
              >
                <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden />
                {warning}
              </li>
            ))}
          </ul>
        )}

        {busy ? (
          <Button variant="secondary" onClick={onCancel} fullWidth>
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!image}
            // After a result the primary action starts a *new* job on a new image;
            // the re-run is the keyboard shortcut, so nothing is lost.
            onClick={result ? onAnother : onCompress}
            icon={<Zap className="size-3.5" aria-hidden />}
            iconRight={
              <span
                aria-hidden
                className="ml-auto hidden rounded-xs border border-white/25 bg-white/10 px-1 font-mono text-[9.5px] leading-[15px] text-white/70 sm:inline-block"
              >
                ⌘↵
              </span>
            }
          >
            {result ? 'Compress again' : 'Compress image'}
          </Button>
        )}

        <Button
          variant="secondary"
          fullWidth
          disabled={!result}
          onClick={onDownload}
          icon={<Download className="size-3.5" aria-hidden />}
        >
          Download
        </Button>

      </div>
    </div>
  );
};
