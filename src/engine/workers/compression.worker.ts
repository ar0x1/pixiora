/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from '@/types/worker';
import { EngineError } from '@/engine/core/EngineTypes';
import { runPipeline } from '@/engine/core/ProcessingPipeline';
import { codecRegistry } from '@/engine/core/CodecRegistry';

/**
 * Compression worker.
 *
 * Owns: decoding, resizing, encoding, verification.
 * Does NOT own: SVG rasterisation (needs `Image`, which workers lack) — the
 * worker manager routes those jobs to the main-thread pipeline instead of
 * failing silently.
 *
 * Cancellation is cooperative: an in-flight WASM encode cannot be interrupted
 * mid-call, so we check the cancel flag between phases and between target-size
 * iterations. The protocol reports CANCELLED only once the work actually stops.
 */

const cancelled = new Set<string>();
const encoder = self as unknown as DedicatedWorkerGlobalScope;

const post = (message: WorkerResponse): void => {
  encoder.postMessage(message);
};

encoder.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === 'READY') {
    void codecRegistry
      .supportedOutputs()
      .then((formats) => post({ type: 'READY', supportedFormats: formats }))
      .catch(() => post({ type: 'READY', supportedFormats: [] }));
    return;
  }

  if (request.type === 'CANCEL') {
    cancelled.add(request.jobId);
    return;
  }

  if (request.type === 'COMPRESS') {
    const { jobId } = request;
    void (async () => {
      try {
        const result = await runPipeline(
          { buffer: request.buffer, fileName: request.fileName, options: request.options },
          {
            report: (progress) => post({ type: 'PROGRESS', jobId, progress }),
            isCancelled: () => cancelled.has(jobId),
          },
        );
        if (cancelled.has(jobId)) {
          post({ type: 'CANCELLED', jobId });
        } else {
          post({ type: 'SUCCESS', jobId, result });
        }
      } catch (error) {
        if (cancelled.has(jobId) || (error instanceof EngineError && error.code === 'CANCELLED')) {
          post({ type: 'CANCELLED', jobId });
        } else {
          const normalized = EngineError.from(error);
          post({
            type: 'ERROR',
            jobId,
            code: normalized.code,
            message: normalized.message,
            detail: normalized.detail,
          });
        }
      } finally {
        cancelled.delete(jobId);
      }
    })();
  }
});
