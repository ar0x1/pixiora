import { Mail } from 'lucide-react';
import { GithubIcon } from '@/components/brand/GithubIcon';
import { CONTACT_EMAIL, SOURCE_URL } from '@/app/constants';

/**
 * Contact and source links — plain anchors, nothing else.
 *
 * No JavaScript click handler: the browser's own navigation is the most reliable
 * way to open a mail client or a repository, and it keeps middle-click, ⌘-click
 * and "copy link address" working exactly as the platform intends.
 *
 * One caveat worth knowing: when this app is shown inside a *sandboxed* preview
 * frame (`sandbox="allow-scripts"`, no `allow-popups` / `allow-top-navigation`),
 * the host page blocks external navigation. That is a limitation of the embedding
 * page, not of these links — opened on its own origin, both work normally.
 */

const linkClass =
  'inline-flex h-7 items-center gap-1.5 rounded-sm border border-line bg-white/[0.04] px-2.5 text-[11.5px] text-ink-dim transition-colors hover:border-line-strong hover:bg-white/[0.07] hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft';

export const ContactActions = () => (
  <>
    <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass} aria-label={`Email ${CONTACT_EMAIL}`}>
      <Mail className="size-3.5" aria-hidden />
      Email
    </a>
    <a
      href={SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
      aria-label={`Open the source code on GitHub at ${SOURCE_URL}`}
    >
      <GithubIcon className="size-3.5" />
      Source
    </a>
  </>
);
