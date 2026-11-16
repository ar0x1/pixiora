import { APP_NAME, AUTHOR } from '@/app/constants';

/**
 * Author credit.
 *
 * One quiet line at the end of the workspace — the same information as the
 * wordmark's credit, placed where a finished job leaves the eye. It is text, not
 * a control: the legal documents, email and source links live on Documentation,
 * so the workspace stays free of chrome that is not part of the job.
 */
export const Credit = () => (
  <footer className="mx-auto mt-5 flex w-full max-w-[1400px] items-center justify-end px-1 pb-1">
    <p className="text-[11px] tracking-[0.06em] text-ink-muted">
      {APP_NAME} <span className="mx-1.5 text-line-strong">·</span> by {AUTHOR}
    </p>
  </footer>
);
