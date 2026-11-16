import type { CompressionOptions } from '@/types/compression';
import { createCanvas, drawableToImageData } from '@/engine/optimization/canvas';

/**
 * Resizing with quality that does not depend on luck.
 *
 * A single `drawImage` downscale in Chromium uses a decent filter, but very
 * large ratios (~>3x) alias badly. We therefore perform progressive halving
 * while the ratio is still large, then finish with one high-quality pass.
 * Upscaling is refused unless explicitly allowed.
 */

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export interface ResizePlan extends Dimensions {
  readonly scaled: boolean;
  /** True when the request asked for a bigger image and was clamped. */
  readonly upscaleBlocked: boolean;
  readonly note?: string;
}

const round = (n: number): number => Math.max(1, Math.round(n));

/**
 * Compute the output size for a source size + constraints.
 * Pure function: unit-tested for aspect-ratio and no-upscale behaviour.
 */
export const planResize = (
  source: Dimensions,
  options: Pick<CompressionOptions, 'maxWidth' | 'maxHeight' | 'fitMode' | 'allowUpscale'>,
): ResizePlan => {
  const { maxWidth, maxHeight, allowUpscale = false, fitMode = 'contain' } = options;
  const noConstraint = !maxWidth && !maxHeight;
  if (noConstraint) {
    return { ...source, scaled: false, upscaleBlocked: false };
  }

  const srcRatio = source.width / source.height;
  let targetW: number;
  let targetH: number;

  if (maxWidth && maxHeight) {
    if (fitMode === 'cover') {
      // Fill the box, cropping overflow.
      if (maxWidth / maxHeight > srcRatio) {
        targetH = maxHeight;
        targetW = round(maxHeight * srcRatio);
      } else {
        targetW = maxWidth;
        targetH = round(maxWidth / srcRatio);
      }
      // For cover the *smaller* side must still cover: expand, don't shrink.
      targetW = Math.max(targetW, maxWidth);
      targetH = Math.max(targetH, maxHeight);
    } else if (fitMode === 'fill') {
      targetW = maxWidth;
      targetH = maxHeight;
    } else {
      // contain: fit inside the box, preserve ratio
      if (maxWidth / maxHeight > srcRatio) {
        targetH = maxHeight;
        targetW = round(maxHeight * srcRatio);
      } else {
        targetW = maxWidth;
        targetH = round(maxWidth / srcRatio);
      }
    }
  } else if (maxWidth) {
    targetW = maxWidth;
    targetH = round(maxWidth / srcRatio);
  } else {
    targetH = maxHeight as number;
    targetW = round((maxHeight as number) * srcRatio);
  }

  let upscaleBlocked = false;
  if (!allowUpscale) {
    if (targetW > source.width || targetH > source.height) {
      const scale = Math.min(source.width / targetW, source.height / targetH);
      targetW = round(targetW * scale);
      targetH = round(targetH * scale);
      upscaleBlocked = true;
    }
  }

  const scaled = targetW !== source.width || targetH !== source.height;
  return {
    width: targetW,
    height: targetH,
    scaled,
    upscaleBlocked,
    note: upscaleBlocked
      ? 'Upscaling was blocked to avoid inventing detail. Enable “Allow upscale” to override.'
      : undefined,
  };
};

/**
 * Percentage-based planning helper.
 *
 * Retained (and unit-tested) as part of the pure dims API, but no workspace can
 * invoke it any more: the Resizer was removed, and `buildOptions` never emits a
 * constraint. It exists so callers that do have a percentage can plan correctly.
 */
export const planPercentResize = (
  source: Dimensions,
  percent: number,
  allowUpscale = false,
): ResizePlan => {
  const factor = Math.max(1, percent) / 100;
  if (!allowUpscale && factor > 1) {
    return { ...source, scaled: false, upscaleBlocked: true, note: 'Upscaling is disabled.' };
  }
  const width = round(source.width * factor);
  const height = round(source.height * factor);
  return { width, height, scaled: width !== source.width || height !== source.height, upscaleBlocked: false };
};

const drawHighQuality = (
  source: CanvasImageSource,
  width: number,
  height: number,
): ImageData => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D context unavailable during resize');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
};

/**
 * Resize RGBA data with progressive halving for large reductions.
 * Returns data at the requested size.
 */
export const resizeImageData = (data: ImageData, plan: ResizePlan): ImageData => {
  if (!plan.scaled) return data;
  if (!plan.upscaleBlocked && plan.width >= data.width && plan.height >= data.height && plan.width <= data.width * 1.5) {
    // Small/typical upscale: one smooth pass is sufficient.
    const src = toCanvas(data);
    return drawHighQuality(src, plan.width, plan.height);
  }

  let current: ImageData = data;
  // Progressive halving while the remaining reduction is still aggressive.
  while (current.width / plan.width >= 2 && current.height / plan.height >= 2) {
    const halfW = Math.max(plan.width, Math.floor(current.width / 2));
    const halfH = Math.max(plan.height, Math.floor(current.height / 2));
    current = drawHighQuality(toCanvas(current), halfW, halfH);
  }
  return drawHighQuality(toCanvas(current), plan.width, plan.height);
};

/**
 * Plan + execute in one call, used by codecs that resize before encoding.
 */
export const applyResize = (data: ImageData, options: CompressionOptions) => {
  const plan = planResize({ width: data.width, height: data.height }, options);
  return { imageData: resizeImageData(data, plan), plan };
};

const toCanvas = (data: ImageData) => {
  const canvas = createCanvas(data.width, data.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D context unavailable during resize');
  ctx.putImageData(data, 0, 0);
  return canvas as CanvasImageSource;
};

export { drawableToImageData };
