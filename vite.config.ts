import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * PIXORA build configuration.
 *
 * Notes on the unusual bits:
 * - `assetsInlineLimit` is 0 for wasm so codec binaries stay separate, cacheable
 *   files instead of being base64-inlined into the worker bundle.
 * - `worker.format = 'es'` is required: codec packages import wasm via `new URL`
 *   and ESM workers are the only reliable way to keep those module graphs intact.
 * - No proxy, no external origins. PIXORA has zero runtime network dependencies.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The app is hosted inside a proxied preview iframe, so the dev server must
  // accept the platform's preview hostnames. This only affects `vite dev`;
  // production builds are static files and have no host allowlist.
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', '.arena.ai', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', '.arena.ai', 'localhost', '127.0.0.1'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    assetsInlineLimit: (filePath: string) => (filePath.endsWith('.wasm') ? false : undefined),
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('libheif')) return 'codec-heif';
          if (id.includes('@jsquash')) return 'codec-jsquash';
          if (id.includes('svgo')) return 'codec-svg';
          if (id.includes('node_modules/react') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('framer-motion')) return 'motion';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // The `forks` pool pulls undici, which needs Node >=22 APIs; threads keeps
    // the suite runnable on Node 20 without changing any test behaviour.
    pool: 'threads',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    server: { deps: { inline: [/@jsquash/] } },
  },
} as Parameters<typeof defineConfig>[0]);
