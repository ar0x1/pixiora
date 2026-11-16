import { EngineError } from '@/engine/core/EngineTypes';

/**
 * Canvas abstraction that works on the main thread *and* inside a worker.
 *
 * `OffscreenCanvas` is preferred (keeps large pixel buffers off the main thread).
 * When it is missing we fall back to `document.createElement('canvas')` on the
 * main thread; inside a worker without OffscreenCanvas we throw a typed error so
 * the worker manager can degrade to main-thread processing instead of lying.
 */

export interface AnyCanvas {
  readonly width: number;
  readonly height: number;
  getContext(type: '2d', options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}

const isWorkerScope = (): boolean =>
  typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;

export const hasOffscreenCanvas = (): boolean =>
  typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvas.prototype.getContext === 'function';

export const createCanvas = (width: number, height: number): AnyCanvas => {
  if (hasOffscreenCanvas()) {
    return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }
  throw new EngineError(
    'WORKER_FAILED',
    'No canvas implementation is available in this environment.',
    isWorkerScope() ? 'Worker lacks OffscreenCanvas; falling back to main-thread processing.' : 'DOM canvas unavailable.',
  );
};

export const canvasToImageData = (canvas: AnyCanvas): ImageData => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new EngineError('DECODER_FAILED', 'Could not obtain a 2D context to read pixels.');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Convert an ImageBitmap / canvas-like into RGBA ImageData.
 * Uses a canvas (not `getImageData` on the source) so colour space is normalised.
 */
export const drawableToImageData = (
  source: CanvasImageSource,
  width: number,
  height: number,
): ImageData => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new EngineError('DECODER_FAILED', 'Could not obtain a 2D context.');
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
};

export const imageDataToCanvas = (data: ImageData): AnyCanvas => {
  const canvas = createCanvas(data.width, data.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new EngineError('ENCODER_FAILED', 'Could not obtain a 2D context for encoding.');
  ctx.putImageData(data, 0, 0);
  return canvas;
};

/** Extract an encoded canvas as a blob (used for the GIF/AVIF alpha paths). */
export const canvasToBlob = async (
  canvas: AnyCanvas,
  type: string,
  quality?: number,
): Promise<Blob> => {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }
  const html = canvas as HTMLCanvasElement;
  return new Promise<Blob>((resolve, reject) => {
    html.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new EngineError('ENCODER_FAILED', 'Canvas encoding returned no data.'))),
      type,
      quality,
    );
  });
};
