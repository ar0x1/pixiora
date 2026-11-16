import { ImageOff } from 'lucide-react';
import type { PixioraImage } from '@/store/imageStore';
import { ComparisonSlider } from '@/components/editor/ComparisonSlider';
import { cn } from '@/utils/cn';

/**
 * Preview surface.
 * - With a result: interactive before/after comparison.
 * - Without: the original, in a non-interactive frame (no fake comparison).
 *
 * The canvas is inset on a black plane with a hairline edge so the image itself
 * is the brightest thing on screen — the UI around it stays out of the way.
 */
export const ImagePreview = ({ image, className }: { image: PixioraImage | null; className?: string }) => {
  if (!image) {
    return (
      <div
        className={cn(
          'flex min-h-[320px] items-center justify-center rounded-md border border-line bg-black/20',
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2 text-ink-muted">
          <ImageOff className="size-5" aria-hidden />
          <p className="text-[12px]">No image open</p>
        </div>
      </div>
    );
  }

  if (image.result && image.resultUrl) {
    return (
      <ComparisonSlider
        className={className}
        beforeSrc={image.previewUrl}
        afterSrc={image.resultUrl}
        beforeBytes={image.result.originalSize}
        afterBytes={image.result.compressedSize}
      />
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-md border border-line bg-black/20', className)}>
      <img
        src={image.previewUrl}
        alt={`Preview of ${image.name}`}
        className="block max-h-[64vh] w-full object-contain"
        decoding="async"
      />
    </div>
  );
};
