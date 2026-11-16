import { EngineError } from '@/engine/core/EngineTypes';

/**
 * Downloads.
 *
 * The object URL is created, clicked and revoked inside a single tick — the
 * browser has already started reading it by the time revoke runs, so nothing
 * leaks and nothing breaks (this ordering is the reliable one across browsers).
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  if (blob.size === 0) {
    throw new EngineError('ENCODER_FAILED', 'Refusing to download an empty file.');
  }
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    throw new EngineError('UNKNOWN', 'The browser blocked the download.', String(error));
  } finally {
    // Give the browser a tick to start the transfer before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
};

/**
 * Sanitise a filename and guarantee uniqueness against already-used names.
 * Returns `photo (2).jpg`, `photo (3).jpg`, … for repeats.
 */
export const uniqueFileName = (name: string, used: Set<string>): string => {
  const sanitised = name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'image';
  if (!used.has(sanitised)) {
    used.add(sanitised);
    return sanitised;
  }
  const dot = sanitised.lastIndexOf('.');
  const stem = dot > 0 ? sanitised.slice(0, dot) : sanitised;
  const ext = dot > 0 ? sanitised.slice(dot) : '';
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${stem} (${n})${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = `${stem}-${Date.now()}${ext}`;
  used.add(fallback);
  return fallback;
};
