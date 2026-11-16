import { ConversionMatrix } from '@/components/documentation/ConversionMatrix';
import { LegalDialogs } from '@/components/layout/LegalDialogs';
import { ContactActions } from '@/components/layout/ContactActions';
import { APP_NAME, AUTHOR } from '@/app/constants';

/**
 * DOCUMENTATION — the engine contract and project information.
 *
 * There is nothing to configure here on purpose: quality (50) and effort (6) are
 * locked, and the resource ceiling (250 MB / 150 MP / 16384 px) is a fixed
 * contract rather than a preference. The encoder inventory (provider names, lossy flags, readiness
 * badges) is not shown — that is an implementation detail. What remains is the conversion matrix:
 * which input can become which output, resolved from the same predicate the Converter uses.
 *
 * Neither panel carries a title bar: the figures are self-describing (each cell
 * is labelled) and the About copy names itself in its first clause, so a header
 * strip would only repeat what is already on screen.
 */
export const SettingsPage = () => (
  <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5">
    <div className="mb-1 px-0.5">
      <h1 className="display text-[27px] leading-tight">Documentation</h1>
    </div>

    <ConversionMatrix />

    <section className="panel overflow-hidden" aria-label="Engine contract">
      <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {[
          { term: 'Max file size', value: '250 MB' },
          { term: 'Max pixels', value: '150 MP' },
          { term: 'Max side', value: '16384 px' },
          { term: 'Quality / effort', value: '50 / 6' },
        ].map((item) => (
          <div key={item.term} className="bg-base p-3">
            <dt className="eyebrow">{item.term}</dt>
            <dd className="tabular mt-1 text-[13px] text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>

    <section className="panel overflow-hidden" aria-label="About">
      <div className="flex flex-col gap-3 p-3.5">
        <p className="text-[11.5px] leading-relaxed text-ink-dim">
          <span className="font-medium text-ink">{APP_NAME}</span> by {AUTHOR} — image compressor/converter.
          Released under the MIT licence. The complete source code is public, including the legal documents
          below.
        </p>
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="eyebrow">Legal and contact</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <LegalDialogs />
            <span aria-hidden className="mx-0.5 hidden h-3 w-px bg-line-strong sm:block" />
            <ContactActions />
          </div>
        </div>
      </div>
    </section>
  </div>
);
