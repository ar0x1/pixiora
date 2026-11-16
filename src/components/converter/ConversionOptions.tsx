import { ArrowRight } from 'lucide-react';
import { ENCODERS, DECODERS, canConvert } from '@/engine/formats/formatCapabilities';
import type { ImportedFormat, OutputFormat } from '@/types/image';
import { cn } from '@/utils/cn';

export interface ConversionOptionsProps {
  sourceFormat: ImportedFormat;
  targetFormat: OutputFormat;
  onTargetChange: (format: OutputFormat) => void;
  hasAlpha: boolean;
  isAnimated: boolean;
}

const TARGETS: OutputFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif', 'svg'];

/**
 * Conversion matrix.
 *
 * Source on the left, target on the right, and every possible target listed as a
 * dense option row — two per row, not a grid of floating cards. Availability
 * comes from the capability table (single source of truth), so an impossible
 * pair can never be presented as selectable, and a pair that loses data says so
 * on the option itself.
 */
export const ConversionOptions = ({
  sourceFormat,
  targetFormat,
  onTargetChange,
  hasAlpha,
  isAnimated,
}: ConversionOptionsProps) => (
  <div className="flex flex-col gap-3">
    <div className="well flex items-center gap-2 px-3 py-2.5">
      <span className="rounded-xs border border-line-strong bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-dim">
        {sourceFormat}
      </span>
      <ArrowRight className="size-3 text-ink-muted" aria-hidden />
      <span className="rounded-xs border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-soft">
        {targetFormat}
      </span>
      <span className="ml-auto truncate text-[10px] text-ink-muted">{DECODERS[sourceFormat].provider}</span>
    </div>

    <div role="radiogroup" aria-label="Target format" className="grid grid-cols-2 gap-1">
      {TARGETS.map((format) => {
        const supported = canConvert(sourceFormat, format);
        const encoder = ENCODERS[format];
        const active = targetFormat === format;
        const losesAlpha = hasAlpha && encoder.transparency === 'none';
        const losesAnimation = isAnimated && format !== 'gif';

        return (
          <button
            key={format}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!supported}
            onClick={() => onTargetChange(format)}
            title={!supported ? `Cannot convert ${sourceFormat.toUpperCase()} to ${encoder.label}` : encoder.provider}
            className={cn(
              'relative flex flex-col items-start gap-0.5 rounded-sm border px-3 py-2.5 text-left transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-soft',
              active
                ? 'border-accent/50 bg-accent/[0.12]'
                : 'border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.04]',
              !supported && 'cursor-not-allowed opacity-35',
            )}
          >
            <span className={cn('text-[11.5px] font-medium leading-tight', active ? 'text-ink' : 'text-ink-dim')}>
              {encoder.label}
            </span>
            <span className="text-[9.5px] uppercase tracking-wide text-ink-muted">
              {encoder.lossy ? 'lossy' : 'lossless'}
              {encoder.transparency === 'full' ? ' · alpha' : ''}
              {encoder.animated ? ' · anim' : ''}
            </span>
            {(losesAlpha || losesAnimation) && supported && (
              <span className="text-[9.5px] text-warn">{losesAnimation ? 'drops animation' : 'flattens alpha'}</span>
            )}
            {active && <span aria-hidden className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-accent-soft" />}
          </button>
        );
      })}
    </div>
  </div>
);
