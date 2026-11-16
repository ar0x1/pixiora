import { useEffect, useState } from 'react';
import { workerManager } from '@/engine/workers/workerManager';

/**
 * Exposes pool capabilities to the UI so status labels are accurate
 * ("Processing in 3 workers" vs "Processing on main thread").
 */
export interface WorkerPoolStatus {
  readonly usingWorkers: boolean;
  readonly concurrency: number;
  readonly hardwareConcurrency: number;
}

export const useWorkerPool = (): WorkerPoolStatus => {
  const [status, setStatus] = useState<WorkerPoolStatus>(() => ({
    usingWorkers: workerManager.usingWorkers,
    concurrency: workerManager.concurrency,
    hardwareConcurrency: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 1) : 1,
  }));

  useEffect(() => {
    setStatus({
      usingWorkers: workerManager.usingWorkers,
      concurrency: workerManager.concurrency,
      hardwareConcurrency: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 1) : 1,
    });
  }, []);

  return status;
};
