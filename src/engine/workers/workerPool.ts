import type { CompressionOptions, CompressionResult, PhaseProgress } from '@/types/compression';
import type { WorkerResponse } from '@/types/worker';
import { EngineError } from '@/engine/core/EngineTypes';

/**
 * Bounded worker pool with a FIFO job queue.
 *
 * Design decisions:
 * - Concurrency is capped (default min(4, hardwareConcurrency-1)) so we never
 *   spawn a worker per file and exhaust memory on large batches.
 * - Each worker handles exactly one job at a time; a job is pinned to a worker
 *   for its whole lifetime so cancellation always reaches the right thread.
 * - A crashed worker fails only *its* current job and is replaced; the queue
 *   keeps draining. Batch isolation is preserved.
 * - Nothing here reports fake progress: callbacks receive the phases the worker
 *   actually reached.
 */

export interface PoolJob {
  readonly jobId: string;
  readonly buffer: ArrayBuffer;
  readonly fileName: string;
  readonly declaredMime: string;
  readonly options: CompressionOptions;
}

export interface PoolCallbacks {
  readonly onProgress?: (jobId: string, progress: PhaseProgress) => void;
  readonly onSuccess?: (jobId: string, result: CompressionResult) => void;
  readonly onError?: (jobId: string, error: EngineError) => void;
  readonly onCancelled?: (jobId: string) => void;
}

interface QueuedJob {
  readonly job: PoolJob;
  readonly callbacks: PoolCallbacks;
}

interface WorkerSlot {
  readonly worker: Worker;
  current: QueuedJob | null;
  readonly id: number;
}

export interface WorkerPoolOptions {
  readonly concurrency?: number;
  readonly workerFactory?: () => Worker;
}

export const createCompressionWorker = (): Worker =>
  new Worker(new URL('./compression.worker.ts', import.meta.url), { type: 'module' });

export class WorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: QueuedJob[] = [];
  private readonly cancelledJobs = new Set<string>();
  private disposed = false;
  private nextSlotId = 1;

  constructor(private readonly options: WorkerPoolOptions = {}) {
    const requested =
      options.concurrency ??
      Math.max(1, Math.min(4, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 2));
    const count = Math.max(1, requested);
    for (let i = 0; i < count; i += 1) {
      this.slots.push(this.spawnSlot());
    }
  }

  get concurrency(): number {
    return this.slots.length;
  }

  get pending(): number {
    return this.queue.length + this.slots.filter((s) => s.current !== null).length;
  }

  private spawnSlot(): WorkerSlot {
    const worker = this.options.workerFactory?.() ?? createCompressionWorker();
    const slot: WorkerSlot = { worker, current: null, id: this.nextSlotId++ };

    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(slot, event.data);
    });

    worker.addEventListener('error', (event: ErrorEvent) => {
      const current = slot.current;
      slot.current = null;
      if (current) {
        current.callbacks.onError?.(
          current.job.jobId,
          new EngineError('WORKER_FAILED', 'A background worker crashed while processing this file.', event.message),
        );
      }
      // Replace the dead worker so the queue keeps moving.
      if (!this.disposed) this.replaceSlot(slot);
    });

    worker.addEventListener('messageerror', () => {
      const current = slot.current;
      slot.current = null;
      if (current) {
        current.callbacks.onError?.(
          current.job.jobId,
          new EngineError('WORKER_FAILED', 'Could not deserialise a worker response.'),
        );
      }
      if (!this.disposed) this.replaceSlot(slot);
    });

    return slot;
  }

  private replaceSlot(dead: WorkerSlot): void {
    try {
      dead.worker.terminate();
    } catch {
      /* already gone */
    }
    const index = this.slots.indexOf(dead);
    if (index >= 0) this.slots[index] = this.spawnSlot();
    this.drain();
  }

  private handleMessage(slot: WorkerSlot, message: WorkerResponse): void {
    if (message.type === 'READY') return;

    const current = slot.current;
    if (!current || current.job.jobId !== message.jobId) {
      // Stale response from a cancelled/previous job: ignore, never misattribute.
      return;
    }

    switch (message.type) {
      case 'PROGRESS':
        current.callbacks.onProgress?.(message.jobId, message.progress);
        return;
      case 'SUCCESS':
        slot.current = null;
        current.callbacks.onSuccess?.(message.jobId, message.result);
        this.drain();
        return;
      case 'ERROR':
        slot.current = null;
        current.callbacks.onError?.(
          message.jobId,
          new EngineError(message.code as EngineError['code'], message.message, message.detail),
        );
        this.drain();
        return;
      case 'CANCELLED':
        slot.current = null;
        current.callbacks.onCancelled?.(message.jobId);
        this.drain();
        return;
      default:
        return;
    }
  }

  submit(job: PoolJob, callbacks: PoolCallbacks = {}): void {
    if (this.disposed) {
      callbacks.onError?.(job.jobId, new EngineError('WORKER_FAILED', 'The worker pool has been shut down.'));
      return;
    }
    this.queue.push({ job, callbacks });
    this.drain();
  }

  /**
   * Cancel a job.
   *
   * Wasm-bindgen encoders are a single synchronous call — they cannot observe a
   * `CANCEL` message until they finish, which is the entire duration of the job.
   * A cooperative flag therefore never worked for a running encode.
   *
   * Queued jobs are dropped from the queue. A running job's worker is *terminated*
   * and replaced, which stops the work immediately; the pool then reports
   * `onCancelled` for that job and the slot comes back clean for the next one.
   */
  cancel(jobId: string): void {
    this.cancelledJobs.add(jobId);

    const queuedIndex = this.queue.findIndex((entry) => entry.job.jobId === jobId);
    if (queuedIndex >= 0) {
      const [entry] = this.queue.splice(queuedIndex, 1);
      entry?.callbacks.onCancelled?.(jobId);
      return;
    }

    const slot = this.slots.find((s) => s.current?.job.jobId === jobId);
    if (!slot || !slot.current) return;

    const current = slot.current;
    slot.current = null;
    current.callbacks.onCancelled?.(jobId);
    this.replaceSlot(slot);
  }

  isCancelled(jobId: string): boolean {
    return this.cancelledJobs.has(jobId);
  }

  private drain(): void {
    if (this.disposed) return;
    for (const slot of this.slots) {
      if (slot.current !== null) continue;
      const next = this.queue.shift();
      if (!next) return;
      if (this.cancelledJobs.has(next.job.jobId)) {
        next.callbacks.onCancelled?.(next.job.jobId);
        // Re-run drain on the same slot by not assigning; loop continues.
        continue;
      }
      slot.current = next;
      slot.worker.postMessage(
        {
          type: 'COMPRESS',
          jobId: next.job.jobId,
          buffer: next.job.buffer,
          fileName: next.job.fileName,
          declaredMime: next.job.declaredMime,
          options: next.job.options,
        },
        [next.job.buffer], // transfer, no copy
      );
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const slot of this.slots) {
      try {
        slot.worker.terminate();
      } catch {
        /* ignore */
      }
      slot.current = null;
    }
    this.queue.length = 0;
  }
}
