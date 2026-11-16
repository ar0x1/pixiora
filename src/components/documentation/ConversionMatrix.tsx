import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Table2 } from 'lucide-react';
import { codecRegistry } from '@/engine/core/CodecRegistry';
import { ENCODERS, canConvert } from '@/engine/formats/formatCapabilities';
import type { ImportedFormat, OutputFormat } from '@/types/image';

/**
 * CONVERSION MATRIX.
 *
 * Every input format against every output format, sampled from the same
 * `canConvert` predicate the Converter uses, so documentation and behaviour
 * cannot drift apart. Columns whose encoder is unavailable in *this* browser are
 * struck through by the live registry probe — that is the only part of the
 * matrix that is machine-dependent, and it is why the cell can never promise a
 * conversion that would fail.
 *
 * Deliberately no encoder inventory: which provider backs which format is an
 * implementation detail, not documentation the user needs. The matrix answers
 * exactly one question — can this input become that output?
 */

const INPUT_FORMATS: readonly ImportedFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'heic', 'tiff'];
const OUTPUT_FORMATS: readonly OutputFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif', 'svg'];

export const ConversionMatrix = () => {
  const [supported, setSupported] = useState<OutputFormat[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void codecRegistry.supportedOutputs().then((formats) => {
      if (!cancelled) setSupported(formats);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const unavailable = useMemo(
    () => (format: OutputFormat) => supported !== null && !supported.includes(format),
    [supported],
  );

  return (
    <section className="panel overflow-hidden" aria-label="Conversion matrix">
      <div className="flex items-baseline justify-between gap-2 px-3.5 pt-3">
        <h2 className="eyebrow flex items-center gap-1.5">
          <Table2 className="size-3 text-ink-muted" aria-hidden />
          Conversion matrix
        </h2>
        <p className="text-[10.5px] text-ink-muted">input → output</p>
      </div>

      <div className="p-3.5 pt-2.5">
        <div className="overflow-x-auto rounded-sm border border-line">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <caption className="sr-only">
              Which input formats can be converted to which output formats in this browser
            </caption>
            <thead>
              <tr className="bg-white/[0.03]">
                <th scope="col" className="eyebrow px-3 py-2.5 font-semibold">
                  In
                </th>
                {OUTPUT_FORMATS.map((format) => (
                  <th key={format} scope="col" className="eyebrow px-1.5 py-2.5 text-center font-semibold">
                    {ENCODERS[format].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INPUT_FORMATS.map((input) => (
                <tr key={input} className="border-t border-line transition-colors duration-150 hover:bg-white/[0.02]">
                  <th scope="row" className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-dim">
                    {input}
                  </th>
                  {OUTPUT_FORMATS.map((output) => {
                    const allowed = canConvert(input, output) && !unavailable(output);
                    return (
                      <td key={output} className="px-1.5 py-2.5 text-center">
                        {allowed ? (
                          <Check className="mx-auto size-3 text-ok" aria-label="supported" />
                        ) : (
                          <Minus className="mx-auto size-3 text-ink-muted/50" aria-label="not supported" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3 text-ok" aria-hidden /> supported
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="size-3 text-ink-muted/50" aria-hidden /> not supported
          </span>
        </div>
      </div>
    </section>
  );
};
