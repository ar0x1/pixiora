/**
 * WASM module loading for the jSquash codecs.
 *
 * Two things make this file necessary:
 *
 * 1. **Toolchain mismatch.** The jSquash codecs come from two toolchains with
 *    different init contracts:
 *      - emscripten (C/C++): MozJPEG, libwebp, libavif → `{ wasmBinary }`
 *      - wasm-bindgen (Rust): squoosh PNG → the source *directly*: a URL string,
 *        a Request, or a raw BufferSource (NOT `{ module_or_path }`; that is the
 *        newer wasm-bindgen API and this build predates it).
 *    Passing the wrong shape throws `WebAssembly.instantiate(): Argument 0 must
 *    be a buffer source`. Worse, the PNG wrapper caches whatever promise
 *    `__wbg_init` returns, so a single wrong call *permanently* poisons the
 *    codec for the page. We therefore get the shape right first time.
 *
 * 2. **URL resolution.** Their built-in defaults resolve `.wasm` relative to the
 *    package, which breaks once Vite rewrites the module graph. Supplying the
 *    binary ourselves is the supported escape hatch.
 *
 * Loading is lazy (only when a codec is first used) and cached per worker, so
 * the first paint never pays for codec bytes and parallel jobs share one load.
 */

type InitStyle = 'emscripten' | 'wasm-bindgen';

interface CodecSpec {
  readonly load: () => Promise<{ init: (arg?: unknown) => Promise<unknown> }>;
  readonly style: InitStyle;
}

const CODECS: Record<string, CodecSpec> = {
  'jpeg-enc': { load: () => import('@jsquash/jpeg/encode.js') as never, style: 'emscripten' },
  'jpeg-dec': { load: () => import('@jsquash/jpeg/decode.js') as never, style: 'emscripten' },
  'webp-enc': { load: () => import('@jsquash/webp/encode.js') as never, style: 'emscripten' },
  'webp-dec': { load: () => import('@jsquash/webp/decode.js') as never, style: 'emscripten' },
  'avif-enc': { load: () => import('@jsquash/avif/encode.js') as never, style: 'emscripten' },
  'avif-dec': { load: () => import('@jsquash/avif/decode.js') as never, style: 'emscripten' },
  // Rust/wasm-bindgen: squoosh's PNG encoder.
  'png-enc': { load: () => import('@jsquash/png/encode.js') as never, style: 'wasm-bindgen' },
};

const cache = new Map<string, Promise<unknown>>();

const fetchBinary = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch codec binary (${response.status}) from ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

/**
 * Initialise a codec exactly once per page/worker lifetime.
 * Concurrent callers share the same promise, so N parallel jobs trigger 1 load.
 */
export const initWasmModule = (name: string, wasmUrl: string): Promise<unknown> => {
  const existing = cache.get(name);
  if (existing) return existing;

  const spec = CODECS[name];
  if (!spec) {
    return Promise.reject(new Error(`Unknown wasm module: ${name}`));
  }

  const promise = (async () => {
    const mod = await spec.load();

    if (spec.style === 'wasm-bindgen') {
      // wasm-bindgen fetches the URL itself (streaming, correct MIME type).
      // A raw BufferSource is the documented fallback for this build.
      try {
        await mod.init(wasmUrl);
        return mod;
      } catch (urlError) {
        const bytes = await fetchBinary(wasmUrl);
        try {
          await mod.init(bytes);
          return mod;
        } catch {
          throw urlError;
        }
      }
    }

    const bytes = await fetchBinary(wasmUrl);
    try {
      await mod.init({ wasmBinary: bytes });
    } catch (primaryError) {
      // Toolchain drifted: try a compiled module, then a bare buffer.
      const module = await WebAssembly.compile(bytes as BufferSource);
      try {
        await mod.init(module);
      } catch {
        try {
          await mod.init(bytes);
        } catch {
          throw primaryError;
        }
      }
    }
    return mod;
  })().catch((error: unknown) => {
    // Never cache a failure — a transient fetch error must stay retryable.
    cache.delete(name);
    throw error;
  });

  cache.set(name, promise);
  return promise;
};

/**
 * wasm URLs. `new URL(..., import.meta.url)` lets Vite emit each binary as a
 * hashed asset and rewrite the reference for both dev and production builds.
 */
export const WASM_URLS = {
  jpegEnc: () => new URL('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm', import.meta.url).href,
  jpegDec: () => new URL('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm', import.meta.url).href,
  pngEnc: () => new URL('@jsquash/png/codec/pkg/squoosh_png_bg.wasm', import.meta.url).href,
  webpEnc: () => new URL('@jsquash/webp/codec/enc/webp_enc.wasm', import.meta.url).href,
  webpDec: () => new URL('@jsquash/webp/codec/dec/webp_dec.wasm', import.meta.url).href,
  avifEnc: () => new URL('@jsquash/avif/codec/enc/avif_enc.wasm', import.meta.url).href,
  avifDec: () => new URL('@jsquash/avif/codec/dec/avif_dec.wasm', import.meta.url).href,
  oxipng: () => new URL('@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm', import.meta.url).href,
} as const;
