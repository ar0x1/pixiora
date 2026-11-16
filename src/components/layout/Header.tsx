import { NavLink, useLocation } from 'react-router-dom';
import { APP_NAME, NAV_ITEMS, SETTINGS_ITEM } from '@/app/constants';
import { Logo } from '@/components/brand/Logo';
import { Wordmark } from '@/components/brand/Wordmark';
import { cn } from '@/utils/cn';

/**
 * Application chrome.
 *
 * One 62px bar: mark + a serif wordmark, the workspace tabs, and the one icon
 * action. Tabs are flat labels with a rule sitting on the bar's own bottom
 * edge — the active state is positional, so it reads instantly without a pill
 * or a glow.
 *
 * Below `md` the tab row is replaced by the bottom tab bar; the mark and the
 * Documentation action stay put.
 */
export const Header = () => {
  const location = useLocation();
  const settingsActive = location.pathname.startsWith(SETTINGS_ITEM.path);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-base/85 backdrop-blur-md">
      <div className="flex h-[62px] items-center gap-2 px-3 sm:px-4">
        <NavLink
          to="/"
          className="flex shrink-0 items-center gap-2.5 pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft"
          aria-label={`${APP_NAME} home`}
        >
          <span className="grid size-[34px] shrink-0 place-items-center rounded-sm border border-line bg-white/[0.03] text-accent-soft">
            <Logo className="size-[26px]" />
          </span>
          <span className="flex flex-col justify-center gap-[5px] leading-none">
            {/* The brand wordmark, traced: lettering in ink, the X in accent. */}
            <Wordmark className="h-[13px] text-ink sm:h-[14px]" />
            <span className="text-[8.5px] font-medium uppercase leading-none tracking-[0.17em] text-ink-muted">
              by ar0x
            </span>
          </span>
        </NavLink>

        <span className="mx-1.5 hidden h-5 w-px bg-line-strong md:block" aria-hidden />

        <nav aria-label="Main navigation" className="-mx-1 hidden min-w-0 flex-1 items-stretch self-stretch px-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex shrink-0 items-center gap-1.5 px-3 text-[13px] transition-colors',
                  isActive ? 'font-medium text-ink' : 'text-ink-muted hover:text-ink-dim',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn('size-3.5 shrink-0', isActive ? 'text-accent-soft' : 'text-current opacity-70')}
                    aria-hidden
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-2.5 bottom-0 h-[2px] rounded-full transition-opacity',
                      isActive ? 'bg-accent-soft opacity-100' : 'opacity-0',
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <NavLink
            to={SETTINGS_ITEM.path}
            aria-label={SETTINGS_ITEM.label}
            aria-current={settingsActive ? 'page' : undefined}
            className={cn(
              'flex size-7 items-center justify-center rounded-sm transition-colors',
              settingsActive
                ? 'bg-white/[0.08] text-ink'
                : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink',
            )}
          >
            <SETTINGS_ITEM.icon className={cn('size-4', settingsActive && 'text-accent-soft')} aria-hidden />
          </NavLink>
        </div>
      </div>
    </header>
  );
};
