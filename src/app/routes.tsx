import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2 } from 'lucide-react';

/**
 * Route table.
 *
 * Every workspace is lazy-loaded so the initial bundle carries only the shell.
 * Codec WASM is loaded even later (on first use), keeping first paint small.
 */
const CompressorPage = lazy(() => import('@/pages/CompressorPage').then((m) => ({ default: m.CompressorPage })));
const ConverterPage = lazy(() => import('@/pages/ConverterPage').then((m) => ({ default: m.ConverterPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const RouteFallback = () => (
  <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
    <Loader2 className="size-5 animate-spin text-ink-muted" aria-hidden />
    <span className="sr-only">Loading workspace…</span>
  </div>
);

const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <AppShell>
        <Suspense fallback={<RouteFallback />}>
          <CompressorPage />
        </Suspense>
      </AppShell>
    ),
  },
  {
    path: '/convert',
    element: (
      <AppShell>
        <Suspense fallback={<RouteFallback />}>
          <ConverterPage />
        </Suspense>
      </AppShell>
    ),
  },
  {
    path: '/settings',
    element: (
      <AppShell>
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </AppShell>
    ),
  },
  {
    path: '*',
    element: (
      <AppShell>
        <Suspense fallback={<RouteFallback />}>
          <NotFoundPage />
        </Suspense>
      </AppShell>
    ),
  },
];

const router = createBrowserRouter(routes);

export const AppRoutes = () => <RouterProvider router={router} />;
export { routes };
