import { Film, Image as ImageIcon, Layers, TriangleAlert, X } from 'lucide-react';
import type { PixioraImage } from '@/store/imageStore';
import { formatBytes } from '@/utils/formatBytes';
import { cn } from '@/utils/cn';

/**
 * The single loaded image, as a strip above the viewer.
 *
 * This replaces the old multi-file list: with one image per workspace there is
 * nothing to select between, so the strip only reports what is loaded and offers
 * the one destructive action (close it).
 */
export const FileChip = ({ image, onRemove }: { image: PixioraImage; onRemove: () => void }) => (
  <div className="flex min-w-0 items-center gap-2.5 px-2 py-1.5">
    <span className="checkerboard relative size-7 shrink-0 overflow-hidden rounded-xs border border-line">
      {image.previewUrl ? (
        // Local object URL only; no remote images are ever referenced.
        <img src={image.previewUrl} alt="" decoding="async" className="size-full object-cover" />
      ) : (
        <ImageIcon className="m-auto size-3 text-ink-muted" aria-hidden />
      )}
    </span>

    <div className="min-w-0 flex-1">
      <p className="truncate text-[12px] font-medium leading-tight text-ink" title={image.name}>
        {image.name}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-ink-muted">
        <span className="uppercase tracking-wide">{image.descriptor.format}</span>
        <span aria-hidden className="text-line-strong">
          /
        </span>
        <span className="tabular">{image.width && image.height ? `${image.width} × ${image.height}` : 'measuring…'}</span>
        <span aria-hidden className="text-line-strong">
          /
        </span>
        <span className="tabular">{formatBytes(image.descriptor.sizeBytes)}</span>
        {image.isAnimated && <Film className="size-2.5 shrink-0" aria-label="animated" />}
        {image.hasAlpha && <Layers className="size-2.5 shrink-0" aria-label="has transparency" />}
        {image.error && <TriangleAlert className="size-2.5 shrink-0 text-danger" aria-label="last attempt failed" />}
      </p>
    </div>

    <button
      type="button"
      onClick={onRemove}
      aria-label={`Close ${image.name}`}
      title="Close image"
      className={cn(
        'shrink-0 rounded-xs p-1 text-ink-muted transition-colors',
        'hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-soft',
      )}
    >
      <X className="size-3.5" aria-hidden />
    </button>
  </div>
);
