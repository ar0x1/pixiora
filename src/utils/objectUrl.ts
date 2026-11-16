/**
 * Object URL lifecycle management.
 *
 * Every URL we create is tracked so it can be revoked deterministically —
 * leaks here are the classic cause of 1 GB+ tabs in image tools. A registry
 * (rather than ad-hoc revoke calls) also lets us revoke on unmount, on replace,
 * and on page unload.
 */

const live = new Set<string>();

export const createObjectUrl = (blob: Blob): string => {
  const url = URL.createObjectURL(blob);
  live.add(url);
  return url;
};

export const revokeObjectUrl = (url: string | null | undefined): void => {
  if (!url) return;
  if (!live.has(url)) return;
  URL.revokeObjectURL(url);
  live.delete(url);
};

export const revokeAllObjectUrls = (): void => {
  for (const url of live) URL.revokeObjectURL(url);
  live.clear();
};

export const liveObjectUrlCount = (): number => live.size;

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', revokeAllObjectUrls);
}
