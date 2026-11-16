import type { CompressionOptions, CompressionResult, PhaseProgress } from './compression';

/**
 * Worker protocol. Every payload is structured-cloneable; buffers are
 * transferred (not copied) wherever the sender no longer needs them.
 */

export interface CompressJobRequest {
  readonly type: 'COMPRESS';
  readonly jobId: string;
  /** Raw file bytes. Transferred to the worker. */
  readonly buffer: ArrayBuffer;
  readonly fileName: string;
  readonly declaredMime: string;
  readonly options: CompressionOptions;
}

export interface CancelJobRequest {
  readonly type: 'CANCEL';
  readonly jobId: string;
}

export interface WorkerReadyRequest {
  readonly type: 'READY';
}

export type WorkerRequest = CompressJobRequest | CancelJobRequest | WorkerReadyRequest;

export interface JobSuccessResponse {
  readonly type: 'SUCCESS';
  readonly jobId: string;
  readonly result: CompressionResult;
}

export interface JobErrorResponse {
  readonly type: 'ERROR';
  readonly jobId: string;
  readonly code: string;
  readonly message: string;
  readonly detail?: string;
}

export interface JobProgressResponse {
  readonly type: 'PROGRESS';
  readonly jobId: string;
  readonly progress: PhaseProgress;
}

export interface JobCancelledResponse {
  readonly type: 'CANCELLED';
  readonly jobId: string;
}

export interface WorkerReadyResponse {
  readonly type: 'READY';
  readonly supportedFormats: readonly string[];
}

export type WorkerResponse =
  | JobSuccessResponse
  | JobErrorResponse
  | JobProgressResponse
  | JobCancelledResponse
  | WorkerReadyResponse;

/** UI-facing job lifecycle. */
export type JobStatus =
  | 'waiting'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface JobState {
  readonly id: string;
  readonly fileId: string;
  readonly status: JobStatus;
  readonly progress: PhaseProgress;
  readonly result?: CompressionResult;
  readonly error?: { code: string; message: string };
  readonly startedAt?: number;
  readonly finishedAt?: number;
}
