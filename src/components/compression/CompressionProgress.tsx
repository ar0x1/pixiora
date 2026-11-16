import { useEffect, useRef, useState } from 'react';
import { ScanLine, Cpu, ShieldCheck, Layers, Sparkles, Check } from 'lucide-react';
import type { PhaseProgress, ProcessingPhase } from '@/types/compression';
import { cn } from '@/utils/cn';

/**
 * Phase-based progress.
 *
 * We deliberately do NOT invent percentages: the WASM encoders expose no internal
 * progress. What this panel does instead is show the *real* phase, with a comet
 * ring, a set of phase pills that snap to done as each stage lands, and a single
 * travelling sheen for texture. The only numbers that ever appear are real ones
 * (attempt i/n during a target-size search).
 *
 * Two rules shape the motion:
 *  1. Honesty — the ring is determinate only where a real index exists, and it
 *     never animates *backwards*.
 *  2. Pacing — a job that finishes in 300 ms should not flash. The panel holds a
 *     900 ms floor and closes its arc on the final frame, so a fast job reads as a
 *     confident checkmark rather than a stutter. The hold is on the *display*, not
 *     the work: the result underneath is already rendered.
 */

const PHASE_ORDER: ProcessingPhase[] = ['queued', 'decoding', 'resizing', 'encoding', 'verifying', 'finalizing'];

const PHASE_COPY: Record<
  ProcessingPhase,
  { label: string; short: string; hint: string; icon: typeof ScanLine }
> = {
  queued: { label: 'Waiting for a worker', short: 'Queue', hint: 'A background worker is being assigned.', icon: Layers },
  decoding: { label: 'Decoding', short: 'Decode', hint: 'Reading pixel data from the source.', icon: ScanLine },
  resizing: { label: 'Resampling', short: 'Resize', hint: 'Applying orientation and preparing the raster.', icon: Layers },
  encoding: { label: 'Encoding', short: 'Encode', hint: 'Compressing with a WebAssembly codec.', icon: Cpu },
  verifying: { label: 'Verifying', short: 'Verify', hint: 'Checking the output is a valid file.', icon: ShieldCheck },
  finalizing: { label: 'Finishing', short: 'Finish', hint: 'Packaging the verified bytes.', icon: Sparkles },
};

/** Phases after "queued" — the ones that get a pill. */
const TRACK = PHASE_ORDER.slice(1);

/** Minimum time the panel stays on screen, so short jobs do not flicker. */
const MIN_VISIBLE_MS = 900;
/** How long the completed state stays up, so the finish is seen, not missed. */
const DONE_HOLD_MS = 420;

const ARC_MASK =
  'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))' as const;

/** Comet ring. Determinate while a real phase index exists; closed on completion. */
const CometRing = ({ percent, complete, icon: Icon }: { percent: number; complete: boolean; icon: typeof ScanLine }) => (
  <div className="relative grid size-10 shrink-0 place-items-center" aria-hidden>
    <span className="absolute inset-0 rounded-full border border-line-strong" />
    <span
      className={cn('absolute inset-0 rounded-full transition-[background] duration-500', complete && 'arc-close')}
      style={{
        background: complete
          ? 'conic-gradient(from -90deg, var(--color-ok) 0%, var(--color-ok) 100%)'
          : `conic-gradient(from -90deg, var(--color-accent-soft) ${percent}%, rgba(255,255,255,0.07) ${percent}%)`,
        mask: ARC_MASK,
        WebkitMask: ARC_MASK,
      }}
    />
    {/* A soft halo, not a glow-blob: 8% alpha, 3px blur. */}
    <span className="absolute inset-[6px] rounded-full bg-accent-soft/[0.08] blur-[3px]" />
    {complete ? (
      <Check className="relative size-3.5 text-ok" strokeWidth={3} />
    ) : (
      <Icon className="relative size-3.5 text-accent-soft" strokeWidth={2} aria-hidden />
    )}
  </div>
);

export const CompressionProgress = ({ progress, done = false }: { progress: PhaseProgress | null; done?: boolean }) => {
  // Nothing to show until a job actually starts. Without this the component
  // mounted with `done === false` and `progress === null` still rendered a
  // completed card — which read as a phantom "Done" on every route change.
  const started = progress !== null;

  const [holding, setHolding] = useState(false);
  const mountedAt = useRef<number>(performance.now());
  const lastPhase = useRef<ProcessingPhase>('queued');

  // A job begins: start the clock and clear any completed state.
  useEffect(() => {
    if (!started) return;
    mountedAt.current = performance.now();
    setHolding(true);
  }, [started]);

  // Hold the final frame for a beat so fast jobs do not flash. The hold never
  // delays the result — it only keeps this card on screen a little longer.
  useEffect(() => {
    if (!done) return;
    const elapsed = performance.now() - mountedAt.current;
    const remaining = Math.max(DONE_HOLD_MS, MIN_VISIBLE_MS - elapsed);
    const timer = window.setTimeout(() => setHolding(false), remaining);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (!started) return null;
  if (done && !holding) return null;

  const phase = progress?.phase ?? lastPhase.current;
  if (progress) lastPhase.current = phase;

  const stepIndex = Math.max(1, PHASE_ORDER.indexOf(phase));
  const copy = PHASE_COPY[phase];
  const attemptRatio =
    progress?.attempt && progress?.attemptsTotal ? (progress.attempt / progress.attemptsTotal) * 100 : undefined;

  // Determinate position: 0 → 100 across the five working phases. Never full
  // until the job is actually done.
  const phasePercent = Math.min(92, (stepIndex / TRACK.length) * 100);
  const percent = done ? 100 : (attemptRatio ?? phasePercent);

  return (
    <div
      role="status"
      aria-live="polite"
      data-progress-panel
      className="panel panel-in relative isolate overflow-hidden"
    >
      {/* Subtle plane shift: a single vertical gradient, no aurora blobs. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(91,156,248,0.06),transparent_60%)]"
      />

      {/* One travelling sheen along the top hairline — texture, not decoration. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden">
        <span className="sheen block h-px w-1/3 bg-gradient-to-r from-transparent via-accent-soft/80 to-transparent" />
      </span>

      <div className="flex items-center gap-3 px-3.5 py-3">
        <CometRing percent={percent} complete={done} icon={copy.icon} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-[12.5px] font-medium tracking-tight text-ink">
              {done ? 'Done' : copy.label}
            </p>
            {attemptRatio !== undefined && !done && (
              <span className="tabular shrink-0 rounded-xs border border-line px-1 py-px text-[9.5px] text-ink-muted">
                pass {progress?.attempt}/{progress?.attemptsTotal}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-ink-muted">{done ? 'Output verified.' : copy.hint}</p>
        </div>
      </div>

      {/* Phase pills: five real stages. Each snaps in as it is reached, and every
          one carries its own glyph so the row reads as a sequence, not a bar. */}
      <ol className="grid grid-cols-5 gap-1 px-3.5 pb-3" aria-hidden>
        {TRACK.map((stage, index) => {
          const phaseIndex = PHASE_ORDER.indexOf(stage);
          const finished = done || phaseIndex < stepIndex;
          const active = !done && phaseIndex === stepIndex;
          const Icon = PHASE_COPY[stage].icon;
          return (
            <li
              key={stage}
              className={cn(
                'flex items-center justify-center gap-1 rounded-xs border py-1.5 transition-colors duration-200',
                finished && 'border-transparent bg-accent-soft/[0.16] font-medium text-accent-soft',
                active && 'pill-in border-accent-soft/60 bg-accent-soft/[0.10] text-ink',
                !finished && !active && 'border-line bg-transparent text-ink-muted/55',
              )}
              style={active ? { animationDelay: '0ms' } : finished ? { animationDelay: `${index * 20}ms` } : undefined}
            >
              {finished && !active ? (
                <Check className="size-2.5 shrink-0" strokeWidth={3} />
              ) : (
                <Icon className="size-2.5 shrink-0" strokeWidth={2.25} />
              )}
              <span className="truncate text-[9.5px] uppercase tracking-[0.07em]">{PHASE_COPY[stage].short}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
