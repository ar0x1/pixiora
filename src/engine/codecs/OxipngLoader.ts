import { EngineError } from '@/engine/core/EngineTypes';

/**
 * oxipng loader — deliberately bypasses `@jsquash/oxipng`'s wrapper module.
 *
 * Why:
 * 1. The wrapper picks its *multi-threaded* build automatically when it detects
 *    a worker scope with hardwareConcurrency > 1. That build needs
 *    `SharedArrayBuffer`, which browsers only expose on cross-origin-isolated
 *    pages (COOP + COEP headers). PIXIORA is a static, header-free app, so the MT
 *    build fails to instantiate — every PNG job died with "engine failed to load".
 * 2. Its `optimise()` entry point re-calls `init()` with no arguments, which
 *    discards the explicit `{ wasmBinary }` we pass at startup.
 *
 * So we import the single-threaded wasm-bindgen package directly, initialise it
 * once with our own bytes, and keep full control. This is a documented technical
 * compromise: PNG optimisation runs single-threaded (slower, same output bytes)
 * to keep the app deployable on static hosting without special headers.
 */

type OptimiseFn = (
  data: Uint8Array,
  level: number,
  interlace: boolean,
  optimizeAlpha: boolean,
) => ArrayBuffer;

interface OxiPackage {
  default: (input: { module_or_path: WebAssembly.Module | BufferSource | string }) => Promise<unknown>;
  optimise: OptimiseFn;
}

let ready: Promise<OptimiseFn> | null = null;

const loadPackage = (): Promise<OxiPackage> =>
  import(
    /* @vite-ignore */
    new URL('@jsquash/oxipng/codec/pkg/squoosh_oxipng.js', import.meta.url).href
  ) as unknown as Promise<OxiPackage>;

/** Initialise once per worker/thread and return the raw optimise function. */
export const getOxipng = (wasmUrl: string): Promise<OptimiseFn> => {
  ready ??= (async () => {
    try {
      const pkg = await loadPackage();
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch oxipng binary (${response.status})`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      // wasm-bindgen's current entry point accepts `module_or_path`; older
      // builds accepted a bare BufferSource. Support both shapes.
      try {
        await pkg.default({ module_or_path: bytes });
      } catch {
        await (pkg.default as unknown as (input: unknown) => Promise<unknown>)(bytes);
      }
      return pkg.optimise;
    } catch (error) {
      ready = null; // never cache a failure
      throw new EngineError(
        'WASM_INIT_FAILED',
        'The PNG optimiser (oxipng) could not be initialised.',
        error instanceof Error ? error.message : String(error),
      );
    }
  })();
  return ready;
};
