import { AppProviders } from '@/app/providers';
import { AppRoutes } from '@/app/routes';

/** Root component: providers wrap the router, nothing else. */
export const App = () => (
  <AppProviders>
    <AppRoutes />
  </AppProviders>
);
