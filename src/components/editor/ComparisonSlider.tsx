import { useCallback, useEffect, useRef, useState } from 'react';
import { Columns2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/formatBytes';
import { SegmentedControl } from '@/components/ui/Primitives';

export interface ComparisonSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeBytes: number;
  afterBytes: number;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

type Mode = 'before' | 'compare' | 'after';

const HIT_W = 24;
const HANDLE_W = 18;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The painted rectangle of an `object-contain` image.
 *
 * The <img> box is the full stage width, but the picture inside it is letterboxed,
 * so `getBoundingClientRect()` describes the stage, not the image. Everything that
 * must sit on the picture (the wipe, the divider, the grip) measures this instead.
 */
const paintedRect = (img: HTMLImageElement): DOMRect => {
  const box = img.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return box;
  const scale = Math.min(img.clientWidth / nw, img.clientHeight / nh);
  const w = nw * scale;
  const h = nh * scale;
  return new DOMRect(box.left + (img.clientWidth - w) / 2, box.top + (img.clientHeight - h) / 2, w, h);
};

/**
 * Before/after comparison.
 *
 * Two synced images share a stacking context; the top one is clipped with
 * `clip-path` (GPU-cheap, no layout thrash). Controls:
 *  - Pointer drag anywhere on the canvas.
 *  - Keyboard: the divider is a real slider (Arrow ±2%, Shift ±10%, Home/End).
 *  - Mode switch to inspect either side alone.
 *
 * The stage is a letterboxed box, so the image is usually narrower than it. The
 * wipe and the divider are therefore positioned inside a box measured from the
 * *rendered image*, not from the stage — otherwise dragging to an edge pushes the
 * divider out into the empty letterbox, outside the picture it is dividing.
 */
export const ComparisonSlider = ({
  beforeSrc,
  afterSrc,
  beforeBytes,
  afterBytes,
  beforeLabel = 'Original',
  afterLabel = 'Compressed',
  className,
}: ComparisonSliderProps) => {
  const [position, setPosition] = useState(50);
  const [mode, setMode] = useState<Mode>('compare');
  // The rendered size of the image, so the overlay can be pinned to the pixels the
  // picture actually occupies rather than to the whole stage.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);

  // Track the rendered image box: on load, on source change, and on any resize.
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const sync = () => {
      const rect = paintedRect(img);
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (!w || !h) return;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };

    sync();
    img.addEventListener('load', sync);
    if (typeof ResizeObserver === 'undefined') return () => img.removeEventListener('load', sync);
    const observer = new ResizeObserver(sync);
    observer.observe(img);
    return () => {
      img.removeEventListener('load', sync);
      observer.disconnect();
    };
  }, [afterSrc]);

  // A new image starts from the middle again.
  useEffect(() => {
    setPosition(50);
  }, [afterSrc]);

  const updateFromClientX = useCallback((clientX: number) => {
    // Measure the picture, not the letterbox: 0% is the image's left edge.
    const img = imageRef.current;
    if (!img) return;
    const rect = paintedRect(img);
    if (!rect.width) return;
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      event.preventDefault();
      updateFromClientX(event.clientX);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [updateFromClientX]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPosition((p) => Math.max(0, p - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPosition((p) => Math.min(100, p + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPosition(100);
    }
  };

  const showBoth = mode === 'compare';

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        ref={containerRef}
        className="relative flex w-full select-none items-center justify-center overflow-hidden rounded-md border border-line bg-black/40"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          if (mode !== 'compare') return;
          dragging.current = true;
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          updateFromClientX(event.clientX);
        }}
      >
        {/* After (base layer) — establishes the box, capped so the page never jumps. */}
        <img
          ref={imageRef}
          src={afterSrc}
          alt={`${afterLabel} preview`}
          className="block max-h-[min(62vh,720px)] w-full object-contain"
          draggable={false}
          decoding="async"
        />

        {/* Everything below is pinned to the rendered image — never to the stage.
            Until the first measurement lands the stage is the best available guess. */}
        <div
          className={cn('pointer-events-none absolute z-10', !box && 'inset-0')}
          style={
            box
              ? {
                  left: `calc(50% - ${box.w / 2}px)`,
                  top: `calc(50% - ${box.h / 2}px)`,
                  width: box.w,
                  height: box.h,
                }
              : undefined
          }
        >
            {/* Before (clipped layer) */}
            {(showBoth || mode === 'before') && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: mode === 'before' ? undefined : `inset(0 ${100 - position}% 0 0)` }}
                aria-hidden={mode !== 'before'}
              >
                <img
                  src={beforeSrc}
                  alt={`${beforeLabel} preview`}
                  className="block size-full object-contain"
                  draggable={false}
                  decoding="async"
                />
              </div>
            )}

            {/* The wipe edge: a hairline exactly on the split. */}
            {showBoth && (
              <div
                className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white/70"
                style={{ left: `${position}%` }}
              />
            )}

            {/* The grip follows the hairline but is held inside the picture, so it never
                hangs off into the letterbox at either extreme. */}
            {showBoth && (
              <div
                role="slider"
                tabIndex={0}
                aria-label="Comparison position"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(position)}
                aria-valuetext={`${Math.round(position)}% original shown, ${100 - Math.round(position)}% compressed`}
                onKeyDown={onKeyDown}
                className="pointer-events-auto absolute inset-y-0 z-20 cursor-ew-resize focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-soft"
                style={
                  box
                    ? {
                        left: clamp((position / 100) * box.w - HIT_W / 2, 0, Math.max(0, box.w - HIT_W)),
                        width: HIT_W,
                      }
                    : { left: `${position}%`, width: HIT_W, transform: 'translateX(-50%)' }
                }
              >
                <div
                  className="absolute top-1/2 flex h-7 items-center justify-center rounded-sm border border-white/40 bg-base/90"
                  style={
                    box
                      ? {
                          left:
                            clamp((position / 100) * box.w - HANDLE_W / 2, 0, Math.max(0, box.w - HANDLE_W)) -
                            clamp((position / 100) * box.w - HIT_W / 2, 0, Math.max(0, box.w - HIT_W)),
                          width: HANDLE_W,
                          transform: 'translateY(-50%)',
                        }
                      : { left: '50%', width: HANDLE_W, transform: 'translate(-50%, -50%)' }
                  }
                >
                  <Columns2 className="size-3 text-ink" aria-hidden />
                </div>
              </div>
            )}
        </div>

        {/* Labels: corner chips, monospaced numbers. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-2">
          {(showBoth || mode === 'before') && (
            <span className="rounded-xs border border-line-strong bg-base/85 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-dim backdrop-blur">
              {beforeLabel} · <span className="tabular">{formatBytes(beforeBytes)}</span>
            </span>
          )}
          {(showBoth || mode === 'after') && (
            <span className="ml-auto rounded-xs bg-accent-strong px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              {afterLabel} · <span className="tabular">{formatBytes(afterBytes)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Control row: mode switch left, hint right. */}
      <div className="flex items-center justify-between gap-2 px-0.5 pt-2">
        <SegmentedControl<Mode>
          label="Comparison mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'before', label: 'Original', icon: <EyeOff className="size-3" aria-hidden /> },
            { value: 'compare', label: 'Compare', icon: <Columns2 className="size-3" aria-hidden /> },
            { value: 'after', label: afterLabel, icon: <Eye className="size-3" aria-hidden /> },
          ]}
        />
        <p className="hidden text-[10.5px] text-ink-muted sm:block">
          Drag the divider · <span className="kbd">←</span> <span className="kbd">→</span> to nudge
        </p>
      </div>
    </div>
  );
};
