import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { CompressionResult } from '@/types/compression';
import { formatBytes } from '@/utils/formatBytes';
import { calculateSavings } from '@/utils/calculateSavings';
import { cn } from '@/utils/cn';

/**
 * Result readout.
 *
 * A single horizontal strip of real numbers, separated by hairlines — no cards,
 * no boxes, no icons per cell. The one number that matters (size change) is set
 * large; everything else is supporting data.
 *
 * Every figure comes from the actual encode. If the output grew, that is stated
 * plainly in warning colour. Verification and applied-setting notes are not shown
 * here: they are diagnostics, not results, and they were drowning the numbers.
 */
export const CompressionStats = ({ result, fileName }: { result: CompressionResult; fileName: string }) => {
  const savings = calculateSavings(result.originalSize, result.compressedSize);

  // Original → output is the headline pair, so it is rendered as one unit with an
  // arrow between the two figures rather than across a divider. Everything after
  // it is supporting data.
  const cells = [
    { label: 'Dimensions', value: `${result.width} × ${result.height}` },
    { label: 'Format', value: result.format.toUpperCase() },
  ];

  return (
    <div className="panel overflow-hidden">
      {/* What the file is called, and the exact byte counts either side of it. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-[11.5px] text-ink-dim" title={fileName}>
          {fileName}
        </p>
        <p className="tabular flex shrink-0 items-center gap-1.5 text-[11.5px]">
          <span className="text-ink-muted">{formatBytes(result.originalSize)}</span>
          <ArrowRight className="size-2.5 text-ink-muted" aria-hidden />
          <span className="font-medium text-ink">{formatBytes(result.compressedSize)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-stretch">
        {/* Size change — the headline number. */}
        <div className="flex min-w-[200px] flex-col justify-center border-line px-4 py-3">
          <p className="eyebrow">Size change</p>
          <p
            className={cn(
              'mt-1 flex items-baseline gap-1 font-serif text-[26px] leading-none tracking-tight tabular',
              savings.grew ? 'text-warn' : 'text-ok',
            )}
          >
            {savings.grew ? <ArrowUpRight className="size-4 self-center" aria-hidden /> : <ArrowDownRight className="size-4 self-center" aria-hidden />}
            {Math.abs(savings.percent).toFixed(1)}
            <span className="text-[12px] font-medium text-ink-muted">%</span>
          </p>
          <p className="tabular mt-1.5 text-[11px] text-ink-muted">
            {savings.grew ? 'grew by ' : 'saved '}
            {formatBytes(Math.abs(savings.bytes))}
          </p>
        </div>

        {/* Original → output, then the supporting figures. */}
        <dl className="flex flex-1 items-stretch border-l border-line">
          {/* Both figures keep the strip's normal left alignment. The arrow lives in a
              fixed spacer between them and is centred on that spacer — so it is centred
              on the gap by construction, regardless of how wide the numbers are. */}
          <div className="min-w-0 flex-1 px-3.5 py-2.5">
            <dt className="eyebrow">Original</dt>
            <dd className="tabular mt-0.5 truncate text-[12px] text-ink-dim">{formatBytes(result.originalSize)}</dd>
          </div>

          <div className="relative w-10 shrink-0" aria-hidden>
            <ArrowRight className="absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-ink-muted/80" />
          </div>

          <div className="min-w-0 flex-1 px-3.5 py-2.5">
            <dt className="eyebrow">Output</dt>
            <dd className="tabular mt-0.5 truncate text-[12px] text-ink">{formatBytes(result.compressedSize)}</dd>
          </div>

          {cells.map((cell) => (
            <div key={cell.label} className="min-w-0 flex-1 border-l border-line px-3.5 py-2.5">
              <dt className="eyebrow">{cell.label}</dt>
              <dd className="tabular mt-0.5 truncate text-[12px] text-ink-dim">{cell.value}</dd>
            </div>
          ))}
        </dl>
      </div>

    </div>
  );
};
