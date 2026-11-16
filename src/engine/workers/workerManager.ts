import type { CompressionOptions, CompressionResult, PhaseProgress } from '@/types/compression';
import { EngineError } from '@/engine/core/EngineTypes';
import { WorkerPool, type PoolCallbacks } from '@/engine/workers/workerPool';
import { detectFormatFromBytes } from '@/engine/core/FormatDetector';
import { runPipeline } from '@/engine/core/ProcessingPipeline';

/**
 * Worker manager — the only surface the React layer talks to.
 *
 * Routing rules:
 * - Raster formats → worker pool (WASM encoding never blocks the UI thread).
 * - SVG input/output → main thread, because rasterising an SVG needs `Image`,
 *   which is not available in a DedicatedWorkerGlobalScope. This is a documented
 *   compromise, not a silent fallback: the job simply runs where it can work.
 * - If worker construction throws (restricted CSP, exotic browser), we degrade
 *   to main-thread processing and still complete the job correctly.
 */

export interface ManagedJob {
  readonly jobId: string;
  readonly buffer: ArrayBuffer;
  readonly fileName: string;
  readonly declaredMime: string;
  readonly options: CompressionOptions;
}

export interface ManagerCallbacks extends PoolCallbacks {}

class WorkerManager {
  private pool: WorkerPool | null = null;
  private workersUnavailable = false;
  private readonly active = new Map<string, { cancelled: boolean }>();

  private ensurePool(): WorkerPool | null {
    if (this.workersUnavailable) return null;
    if (this.pool) return this.pool;
    try {
      this.pool = new WorkerPool();
      return this.pool;
    } catch {
      this.workersUnavailable = true;
      return null;
    }
  }

  /**
   * True when workers are usable in this environment. A pool is created lazily
   * on the first job, so we report *availability* rather than instantiation —
   * otherwise the header would claim "main thread" before any work has run.
   */
  get usingWorkers(): boolean {
    if (this.workersUnavailable) return false;
    if (this.pool) return true;
    return typeof Worker === 'function';
  }

  /** Capacity the pool will use (actual pool size once it exists). */
  get concurrency(): number {
    if (this.pool) return this.pool.concurrency;
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 2) : 2;
    return Math.max(1, Math.min(4, cores));
  }

  submit(job: ManagedJob, callbacks: ManagerCallbacks = {}): void {
    this.active.set(job.jobId, { cancelled: false });

    const wrapped: ManagerCallbacks = {
      onProgress: (id, progress: PhaseProgress) => callbacks.onProgress?.(id, progress),
      onSuccess: (id, result: CompressionResult) => {
        this.active.delete(id);
        callbacks.onSuccess?.(id, result);
      },
      onError: (id, error: EngineError) => {
        this.active.delete(id);
        callbacks.onError?.(id, error);
      },
      onCancelled: (id) => {
        this.active.delete(id);
        callbacks.onCancelled?.(id);
      },
    };

    const sourceIsSvg = this.sniffSvg(job);

    if (sourceIsSvg) {
      void this.runOnMainThread(job, wrapped);
      return;
    }

    const pool = this.ensurePool();
    if (!pool) {
      void this.runOnMainThread(job, wrapped);
      return;
    }
    pool.submit(job, wrapped);
  }

  private sniffSvg(job: ManagedJob): boolean {
    try {
      return detectFormatFromBytes(new Uint8Array(job.buffer, 0, Math.min(4096, job.buffer.byteLength))) === 'svg';
    } catch {
      return false;
    }
  }

  private async runOnMainThread(job: ManagedJob, callbacks: ManagerCallbacks): Promise<void> {
    const token = this.active.get(job.jobId);
    try {
      callbacks.onProgress?.(job.jobId, { phase: 'decoding' });
      const result = await runPipeline(
        { buffer: job.buffer, fileName: job.fileName, options: job.options },
        {
          report: (progress) => {
            if (!token?.cancelled) callbacks.onProgress?.(job.jobId, progress);
          },
          isCancelled: () => token?.cancelled === true,
        },
      );
      if (token?.cancelled) {
        this.active.delete(job.jobId);
        callbacks.onCancelled?.(job.jobId);
        return;
      }
      callbacks.onSuccess?.(job.jobId, result);
    } catch (error) {
      const normalized = EngineError.from(error);
      if (normalized.code === 'CANCELLED') {
        this.active.delete(job.jobId);
        callbacks.onCancelled?.(job.jobId);
        return;
      }
      this.active.delete(job.jobId);
      callbacks.onError?.(job.jobId, normalized);
    }
  }

  /** Cooperative cancellation; may take effect between phases. */
  cancel(jobId: string): void {
    const token = this.active.get(jobId);
    if (token) token.cancelled = true;
    this.pool?.cancel(jobId);
  }

  cancelAll(): void {
    for (const [jobId, token] of this.active.entries()) {
      token.cancelled = true;
      this.pool?.cancel(jobId);
    }
  }

  dispose(): void {
    this.pool?.dispose();
    this.pool = null;
    this.active.clear();
  }
}

export const workerManager = new WorkerManager();
export { WorkerManager };
