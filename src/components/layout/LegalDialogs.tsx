import { useState } from 'react';
import { ScrollText, ShieldCheck, Scale } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { LEGAL_DOCUMENTS, LEGAL_ORDER, type LegalDocument } from '@/app/legal';
import { cn } from '@/utils/cn';

/**
 * Legal documents — Terms of Service, Privacy Policy and Licence.
 *
 * Rendered as real modals (focus trap, Escape, click-outside, focus restore) from
 * `src/app/legal.ts`, so the copy shown here and the copy in the README cannot
 * drift apart. Used from the Settings page only; the workspace footer carries
 * just the author credit.
 */

const LEGAL_ICONS: Record<LegalDocument['id'], React.ReactNode> = {
  terms: <ScrollText className="size-3" aria-hidden />,
  privacy: <ShieldCheck className="size-3" aria-hidden />,
  licence: <Scale className="size-3" aria-hidden />,
};

export const LegalDialogs = () => {
  const [openDoc, setOpenDoc] = useState<LegalDocument['id'] | null>(null);
  const doc = openDoc ? LEGAL_DOCUMENTS[openDoc] : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {LEGAL_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpenDoc(id)}
            className={cn(
              'group relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-sm border border-line px-2.5',
              'text-[11px] text-ink-dim transition-colors duration-150',
              'hover:border-line-strong hover:bg-white/[0.04] hover:text-ink',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft',
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-accent-soft transition-transform duration-200 group-hover:scale-x-100"
            />
            {LEGAL_ICONS[id]}
            {LEGAL_DOCUMENTS[id].title}
          </button>
        ))}
      </div>

      <Dialog
        open={doc !== null}
        onClose={() => setOpenDoc(null)}
        title={doc?.title ?? ''}
        description={doc ? `${doc.summary} · Last updated ${doc.updated}` : undefined}
        size="lg"
        footer={
          <Button size="sm" variant="subtle" onClick={() => setOpenDoc(null)}>
            Close
          </Button>
        }
      >
        {doc && (
          <div className="flex flex-col gap-3.5">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="eyebrow mb-1">{section.heading}</h3>
                <div className="flex flex-col gap-1.5">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-[11.5px] leading-relaxed text-ink-dim">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
};
