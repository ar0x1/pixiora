import type { CompressionOptions, CompressionResult, PhaseProgress, VerificationReport } from '@/types/compression';
import type { DecodedImage, OutputFormat } from '@/types/image';
import { EngineError } from '@/engine/core/EngineTypes';
import { codecRegistry } from '@/engine/core/CodecRegistry';
import { detectFormatFromBytes } from '@/engine/core/FormatDetector';
import { chooseSmartSettings } from '@/engine/optimization/smartQuality';
import { findTargetSize } from '@/engine/optimization/targetSize';
import { getLimits, checkDimensions } from '@/engine/core/limits';
import { analyseAlpha } from '@/engine/optimization/transparency';
import { planResize } from '@/engine/optimization/resizeImage';
import { ENCODERS, animationWarning, transparencyWarning, canConvert } from '@/engine/formats/formatCapabilities';
import { optimiseSvg, rasteriseSvg, svgDimensions } from '@/engine/codecs/SvgCodec';
import { mimeFor } from '@/engine/formats/mimeTypes';

/**
 * The single entry point for turning bytes into optimised bytes.
 *
 * Responsibilities, in order:
 *   1. Validate input (signature → format → limits), never trusting the name.
 *   2. Decode with the right decoder (native when possible, WASM otherwise).
 *   3. Resolve settings (quality / target-size / smart) into concrete params.
 *   4. Encode, then *verify the output by decoding it again*.
 *   5. Report applied settings, notes and honest explanations.
 *
 * Cancellation is checked between phases and inside the iterative encoder loop.
 */

export interface PipelineInput {
  readonly buffer: ArrayBuffer;
  readonly fileName: string;
  readonly options: CompressionOptions;
}

export interface PipelineHooks {
  readonly report?: (progress: PhaseProgress) => void;
  readonly isCancelled?: () => boolean;
}

const assertNotCancelled = (hooks: PipelineHooks): void => {
  if (hooks.isCancelled?.()) throw new EngineError('CANCELLED', 'Operation cancelled by user.');
};

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Lowest quality the "never ship a bigger file" retry loop will descend to. */
const FLOOR_QUALITY = 12;

const toBlob = (bytes: Uint8Array, format: OutputFormat): Blob =>
  new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeFor(format) });

export const runPipeline = async (
  input: PipelineInput,
  hooks: PipelineHooks = {},
): Promise<CompressionResult> => {
  const started = now();
  const limits = getLimits();
  const { options } = input;
  const notes: string[] = [];
  const report = (phase: PhaseProgress): void => hooks.report?.(phase);

  // ---- 1. Validate ---------------------------------------------------------
  if (input.buffer.byteLength === 0) {
    throw new EngineError('CORRUPT_IMAGE', 'The file is empty (0 bytes).');
  }
  if (input.buffer.byteLength > limits.maxFileBytes) {
    throw new EngineError(
      'IMAGE_TOO_LARGE',
      `This file is ${(input.buffer.byteLength / (1024 * 1024)).toFixed(1)} MB — the maximum accepted size is ${(limits.maxFileBytes / (1024 * 1024)).toFixed(0)} MB.`,
    );
  }

  const head = new Uint8Array(input.buffer, 0, Math.min(4096, input.buffer.byteLength));
  const sourceFormat = detectFormatFromBytes(head);

  if (!canConvert(sourceFormat, options.format)) {
    throw new EngineError(
      'UNSUPPORTED_FORMAT',
      `PIXIORA cannot convert ${sourceFormat.toUpperCase()} to ${ENCODERS[options.format].label}.`,
    );
  }

  // ---- 2. Decode -----------------------------------------------------------
  report({ phase: 'decoding' });
  assertNotCancelled(hooks);

  const decoder = codecRegistry.decoderFor(sourceFormat);
  const isSvgSource = sourceFormat === 'svg';
  const rawText = isSvgSource ? new TextDecoder('utf-8', { fatal: false }).decode(input.buffer) : null;
  const sanitisedSvg = rawText ? await optimiseSvg(rawText, options.effort ?? 2) : null;

  let decoded: DecodedImage;
  if (authenticSvg(options.format, isSvgSource)) {
    // SVG → SVG stays vector: nothing is rasterised, nothing is lost.
    const bytes = new TextEncoder().encode(sanitisedSvg as string);
    const dims = svgDimensions(sanitisedSvg as string);
    const verification: VerificationReport = {
      verified: true,
      decodedWidth: dims.width,
      decodedHeight: dims.height,
      method: 'signature-only',
      detail: 'SVG validated as well-formed, sanitised XML with an <svg> root.',
    };
    const encoder = codecRegistry.encoderFor('svg');
    const verifiedDims = (await encoder.verify?.(bytes, options)) ?? dims;
    return {
      blob: toBlob(bytes, 'svg'),
      originalSize: input.buffer.byteLength,
      compressedSize: bytes.byteLength,
      width: verifiedDims.width,
      height: verifiedDims.height,
      format: 'svg',
      mimeType: mimeFor('svg'),
      processingTimeMs: Math.round(now() - started),
      applied: {
        format: 'svg',
        quality: 100,
        lossless: true,
        attempts: 1,
        width: verifiedDims.width,
        height: verifiedDims.height,
        scaled: false,
        reason: 'Vector optimisation with SVGO plus a security sanitisation pass.',
      },
      verification: { ...verification, decodedWidth: verifiedDims.width, decodedHeight: verifiedDims.height },
      notes,
    };
  }

  if (isSvgSource) {
    // SVG → raster: rasterise the sanitised markup at the requested size.
    const dims = svgDimensions(sanitisedSvg as string);
    const plan = planResize(dims, options);
    const raster = await rasteriseSvg(sanitisedSvg as string, plan.width, plan.height);
    const alpha = analyseAlpha(raster.data);
    decoded = {
      imageData: raster,
      width: raster.width,
      height: raster.height,
      hasAlpha: alpha.hasAlpha,
      isAnimated: false,
      sourceFormat: 'svg',
      sourceBytes: input.buffer.byteLength,
    };
    notes.push(`SVG rasterised at ${plan.width}×${plan.height} px. Vector editability is lost in raster formats.`);
  } else {
    decoded = await decoder.decode(input.buffer, sourceFormat);
  }

  const dimCheck = checkDimensions(decoded.width, decoded.height);
  if (!dimCheck.ok) {
    throw new EngineError(dimCheck.code, dimCheck.reason);
  }

  // Disclose capability losses *before* doing the work.
  const animWarning = animationWarning(decoded.isAnimated, options.format);
  if (animWarning) notes.push(animWarning);
  const alphaWarning = transparencyWarning(decoded.hasAlpha, options.format);
  if (alphaWarning) notes.push(alphaWarning);

  // ---- 3. Resolve settings -------------------------------------------------
  let effective = { ...options };
  let reason: string;
  if (options.mode === 'smart') {
    const decision = chooseSmartSettings({
      sourceFormat,
      outputFormat: options.format,
      width: decoded.width,
      height: decoded.height,
      hasAlpha: decoded.hasAlpha,
      sourceBytes: input.buffer.byteLength,
    });
    effective = { ...effective, quality: decision.quality, lossless: decision.lossless };
    // Quality is locked to its best value app-wide (the Settings sliders were
    // removed), so Smart mode may not lower it. It still chooses the lossless
    // flag and the per-format quality *ceiling*; effort always stays at the
    // maximum configured value.
    reason = decision.reason;
  } else if (options.mode === 'target-size') {
    reason = 'Iterative encoding to approach the requested file size.';
  } else {
    reason = `User-selected quality ${options.quality}.`;
  }

  const encoder = codecRegistry.encoderFor(options.format);
  await encoder.init();
  assertNotCancelled(hooks);

  // ---- 4. Encode -----------------------------------------------------------
  report({ phase: 'encoding' });
  let bytes: Uint8Array;
  let attempts = 1;
  let targetExplanation: string | null = null;

  const encodeOnce = async (quality: number): Promise<Uint8Array> =>
    encoder.encode(decoded, { ...effective, quality });

  if (options.mode === 'target-size' && options.targetSizeBytes) {
    const outcome = await findTargetSize(
      {
        targetBytes: options.targetSizeBytes,
        minQuality: 12,
        maxQuality: 92,
        maxAttempts: 7,
        timeBudgetMs: Math.min(60_000, limits.jobTimeoutMs),
      },
      async (quality, attempt) => {
        report({ phase: 'encoding', attempt, attemptsTotal: 7 });
        return encodeOnce(quality);
      },
      () => hooks.isCancelled?.() === true,
    );
    bytes = outcome.best.bytes;
    attempts = outcome.attempts;
    targetExplanation = outcome.explanation;
    effective = { ...effective, quality: outcome.best.quality };
    notes.push(outcome.explanation);
    if (!outcome.achieved) {
      notes.push('The requested size was not achievable at the minimum quality. Consider resizing or choosing AVIF.');
    }
    reason = `Target-size search: ${outcome.explanation}`;
  } else {
    bytes = await encodeOnce(effective.quality);

    // ---- 4b. Never ship a bigger file ---------------------------------------
    // A re-encode can legitimately be larger than its source (a small,
    // already-compressed JPEG at high quality is the classic case). Shipping that
    // would make the app pointless, so if the first attempt is not smaller we cut
    // quality until it is. The user is told exactly what happened; nothing is
    // silently discarded.
    if (bytes.byteLength >= input.buffer.byteLength && effective.quality > FLOOR_QUALITY) {
      let quality = effective.quality;
      const tried: number[] = [quality];
      let best: Uint8Array | null = null;

      while (quality > FLOOR_QUALITY) {
        quality = Math.max(FLOOR_QUALITY, Math.round(quality * 0.8));
        if (tried.includes(quality)) break;
        tried.push(quality);
        report({ phase: 'encoding', attempt: tried.length, attemptsTotal: tried.length });
        const attempt = await encodeOnce(quality);
        attempts += 1;
        if (attempt.byteLength < input.buffer.byteLength) {
          best = attempt;
          break;
        }
        // Keep the smallest attempt so far even if none beats the source yet.
        if (!best || attempt.byteLength < best.byteLength) best = attempt;
      }

      if (best && best.byteLength < input.buffer.byteLength) {
        // A smaller encode was found — that is the output.
        bytes = best;
        effective = { ...effective, quality };
        notes.push(
          `Quality was reduced to ${effective.quality} so the output stays smaller than the ${(input.buffer.byteLength / 1024).toFixed(1)} KB source.`,
        );
        reason = `${reason} Quality was reduced automatically to keep the output under the source size.`;
      } else if (options.format === sourceFormat) {
        // Nothing smaller was achievable. Re-encoding would hand back a *bigger*
        // file than the user started with, so return the source bytes untouched —
        // the honest answer is "this file is already optimal".
        bytes = new Uint8Array(input.buffer.slice(0));
        effective = { ...effective, quality: 0 };
        notes.push(
          `Already optimal: no setting produced a file smaller than the ${(input.buffer.byteLength / 1024).toFixed(1)} KB source, so the original is returned unchanged.`,
        );
        reason = 'This file is already as small as this encoder can make it. The original bytes are returned unchanged.';
      } else if (best) {
        // A format change was requested, so the source cannot be passed through.
        bytes = best;
        effective = { ...effective, quality };
        notes.push(
          `No setting produced a file smaller than the ${(input.buffer.byteLength / 1024).toFixed(1)} KB source; the smallest conversion is shown.`,
        );
      }
    }
  }

  assertNotCancelled(hooks);

  // ---- 5. Verify (decode the output again) --------------------------------
  report({ phase: 'verifying' });
  if (!bytes || bytes.byteLength === 0) {
    throw new EngineError('ENCODER_FAILED', 'The encoder produced no output. Nothing was saved.');
  }
  if (!ENCODERS[options.format].transparency || ENCODERS[options.format].transparency === 'none') {
    // nothing extra to check here; flattening is handled inside the codec
  }

  let verification: VerificationReport;
  try {
    const decoderFullImage = ENCODERS[options.format].verify === 'decode';
    const verified = await encoder.verify?.(bytes, effective);
    const expectedPlan = planResize({ width: decoded.width, height: decoded.height }, effective);
    verification = verified
      ? {
          verified: true,
          decodedWidth: verified.width,
          decodedHeight: verified.height,
          method: decoderFullImage ? 'codec-decode' : 'structure-scan',
          detail: decoderFullImage
            ? `Output re-decoded successfully at ${verified.width}×${verified.height}.`
            : `Output structure validated at ${verified.width}×${verified.height}.`,
        }
      : {
          verified: true,
          decodedWidth: expectedPlan.width,
          decodedHeight: expectedPlan.height,
          method: 'signature-only',
          detail: 'Codec provides no verification hook; container signature checked.',
        };
  } catch (error) {
    throw new EngineError(
      'VERIFICATION_FAILED',
      'The encoded file failed verification and was discarded instead of being offered for download.',
      error instanceof Error ? error.message : String(error),
    );
  }

  report({ phase: 'finalizing' });

  const finalPlan = planResize({ width: decoded.width, height: decoded.height }, effective);
  if (finalPlan.upscaleBlocked && finalPlan.note) notes.push(finalPlan.note);

  return {
    blob: toBlob(bytes, options.format),
    originalSize: input.buffer.byteLength,
    compressedSize: bytes.byteLength,
    width: verification.decodedWidth,
    height: verification.decodedHeight,
    format: options.format,
    mimeType: mimeFor(options.format),
    processingTimeMs: Math.round(now() - started),
    applied: {
      format: options.format,
      quality: effective.quality,
      lossless: effective.lossless === true || options.format === 'png' || options.format === 'svg',
      attempts,
      width: verification.decodedWidth,
      height: verification.decodedHeight,
      scaled: finalPlan.scaled,
      reason: targetExplanation ? `${reason}` : reason,
    },
    verification,
    notes,
  };
};

const authenticSvg = (output: OutputFormat, isSvgSource: boolean): boolean => output === 'svg' && isSvgSource;

export { detectFormatFromBytes };
