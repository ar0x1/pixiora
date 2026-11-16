import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { Credit } from '@/components/layout/Credit';
import { ToastStack } from '@/components/ui/Toast';

/**
 * Application frame: top navigation bar, scrollable workspace, mobile tab bar.
 * There is no side rail — navigation lives entirely in the header.
 *
 * The workspace is a single centred column (max 1400px, generous horizontal
 * padding) so the editor and the action rail sit on a comfortable measure at
 * every width, per the design system's layout rules.
 */
export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="relative z-10 flex h-full flex-col">
    <Header />
    <main
      id="workspace"
      className="flex-1 overflow-y-auto px-3 pb-24 pt-3.5 sm:px-5 md:pb-5 lg:px-8"
      aria-label="Workspace"
    >
      <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      <Credit />
    </main>
    <MobileNavigation />
    <ToastStack />
  </div>
);

/**
 * Two-plane workspace.
 *
 * The editor fills the remaining width and the rail is a fixed 320px column, so
 * the primary action never moves when the image changes aspect ratio. The rail
 * is omitted entirely while the workspace is empty — an empty workspace is a
 * landing surface, not a form with disabled buttons. On small screens the rail
 * drops below the editor, which is the only correct order in one column.
 */
export const Workspace = ({ main, aside }: { main: ReactNode; aside?: ReactNode }) => (
  <div className="flex w-full flex-col gap-3.5 lg:flex-row">
    <section className="min-w-0 flex-1" aria-label="Editor">
      {main}
    </section>
    {aside && (
      <aside className="w-full shrink-0 lg:w-[320px]" aria-label="Settings">
        <div className="lg:sticky lg:top-3.5">{aside}</div>
      </aside>
    )}
  </div>
);
