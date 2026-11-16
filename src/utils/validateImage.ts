import type { FileDescriptor } from '@/types/image';
import { EngineError } from '@/engine/core/EngineTypes';
import { detectFileFormat } from '@/engine/core/FormatDetector';
import { getLimits } from '@/engine/core/limits';

/**
 * Upload validation pipeline: empty → size → signature → (later) dimensions.
 * Returns a discriminated result so the UI can show a per-file error without
 * throwing into React's render path.
 */

export interface ValidationSuccess {
  readonly ok: true;
  readonly descriptor: FileDescriptor;
}

export interface ValidationFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export const validateFile = async (file: File): Promise<ValidationResult> => {
  const limits = getLimits();

  if (file.size === 0) {
    return { ok: false, code: 'CORRUPT_IMAGE', message: 'This file is empty (0 bytes).' };
  }
  if (file.size > limits.maxFileBytes) {
    return {
      ok: false,
      code: 'IMAGE_TOO_LARGE',
      message: `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the maximum accepted size is ${(limits.maxFileBytes / (1024 * 1024)).toFixed(0)} MB.`,
    };
  }

  try {
    const descriptor = await detectFileFormat(file);
    return { ok: true, descriptor };
  } catch (error) {
    const normalized = EngineError.from(error, 'UNSUPPORTED_FORMAT');
    return { ok: false, code: normalized.code, message: normalized.message };
  }
};

/** Convenience: validate many files, preserving input order. */
export const validateFiles = async (files: readonly File[]): Promise<{ file: File; result: ValidationResult }[]> =>
  Promise.all(files.map(async (file) => ({ file, result: await validateFile(file) })));
