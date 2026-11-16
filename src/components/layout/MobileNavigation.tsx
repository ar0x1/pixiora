import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/constants';
import { cn } from '@/utils/cn';

/**
 * Bottom tab bar for small screens — workspaces only.
 * Documentation lives in the top bar on every viewport, so it is not duplicated
 * here. The active tab is marked by a rule at the top edge, mirroring the
 * desktop bar, and by the icon/label colour.
 */
export const MobileNavigation = () => (
  <nav
    aria-label="Main navigation"
    className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-base/95 backdrop-blur-md md:hidden"
  >
    {NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] transition-colors',
              isActive ? 'text-ink' : 'text-ink-muted',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-5 top-0 h-[2px] rounded-full',
                  isActive ? 'bg-accent-soft' : 'opacity-0',
                )}
              />
              <Icon className={cn('size-[18px]', isActive && 'text-accent-soft')} aria-hidden />
              <span className={cn('tracking-wide', isActive && 'font-medium')}>{item.label.split(' ')[0]}</span>
            </>
          )}
        </NavLink>
      );
    })}
  </nav>
);
