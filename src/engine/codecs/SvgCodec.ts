import type { DecodedImage } from '@/types/image';
import type { CompressionOptions } from '@/types/compression';
import type { ImageCodec } from '@/engine/core/EngineTypes';
import { EngineError } from '@/engine/core/EngineTypes';
import { drawableToImageData } from '@/engine/optimization/canvas';

/**
 * SVG codec — SVGO optimisation plus a hardened sanitiser.
 *
 * Security model (spec §5, §15):
 *  - Uploaded SVG is NEVER injected into the live DOM.
 *  - It is parsed by SVGO (sax) which does not execute anything.
 *  - Our sanitiser removes script-ish elements, event handler attributes,
 *    javascript:/external URLs, and url() references that point off-document.
 *  - Rasterisation (when the user picks PNG/JPEG/WebP/AVIF) happens through a
 *    `Blob` → `Image` → canvas path with the SVG loaded as an *image*, which
 *    the browser treats as a passive resource (no script execution, no network
 *    subresource loading for our sanitised output).
 */

type SvgoModule = {
  optimize: (
    input: string,
    config?: Record<string, unknown>,
  ) => { data: string; error?: string };
};

let svgo: SvgoModule | null = null;

const loadSvgo = async (): Promise<SvgoModule> => {
  if (svgo) return svgo;
  const mod = (await import('svgo')) as unknown as SvgoModule;
  svgo = mod;
  return mod;
};

const DANGEROUS_ELEMENTS = new Set([
  'script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video',
  'handler', 'listener', 'set', 'animateColor', 'cursor',
]);

interface SvgoNode {
  type: string;
  name?: string;
  attributes?: Record<string, string>;
  children?: SvgoNode[];
  value?: string;
}

/**
 * PIXIORA sanitiser plugin. Runs first so later SVGO passes never see hostile
 * constructs, and again conceptually after preset-default (its output is a
 * subset of the sanitised tree).
 */
const pixioraSanitize = {
  name: 'pixioraSanitize',
  type: 'visitor' as const,
  fn: () => ({
    element: {
      enter: (node: SvgoNode, parentNode: SvgoNode) => {
        if (node.name && DANGEROUS_ELEMENTS.has(node.name)) {
          if (parentNode.children) {
            parentNode.children = parentNode.children.filter((child) => child !== node);
          }
          return;
        }
        const attrs = node.attributes ?? {};
        for (const [attr, rawValue] of Object.entries(attrs)) {
          const value = String(rawValue).trim();
          // Inline event handlers
          if (/^on/i.test(attr)) {
            delete attrs[attr];
            continue;
          }
          // Hyperlinks / sources: allow only in-document fragments and data:image
          if (/^(href|xlink:href|src)$/i.test(attr)) {
            const safe = value.startsWith('#') || /^data:image\//i.test(value);
            if (!safe) delete attrs[attr];
            continue;
          }
          // Any attribute carrying a script URL or an off-document url() reference
          if (/javascript:/i.test(value) || /vbscript:/i.test(value) || /data:text\/html/i.test(value)) {
            delete attrs[attr];
            continue;
          }
          if (/url\(\s*['"]?(?!#)/i.test(value)) {
            delete attrs[attr];
          }
        }
      },
    },
  }),
};

/** Optimise + sanitise SVG source text. Throws on malformed XML. */
export const optimiseSvg = async (source: string, effort = 2): Promise<string> => {
  const { optimize } = await loadSvgo();
  try {
    const result = optimize(source, {
      multipass: effort >= 2,
      floatPrecision: effort >= 3 ? 2 : 3,
      plugins: [
        pixioraSanitize,
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeUnknownsAndDefaults: false, // keeps data-* hooks authors rely on
              cleanupIds: { minify: false },
            },
          },
        },
        // Keep the viewBox: removing it breaks responsive scaling.
        'removeDimensions',
      ],
    });
    return result.data;
  } catch (error) {
    throw new EngineError(
      'CORRUPT_IMAGE',
      'This SVG could not be parsed. It may be malformed XML.',
      error instanceof Error ? error.message : String(error),
    );
  }
};

/** Quick structural validation without SVGO: root must be <svg>. */
export const isSvgDocument = (source: string): boolean => {
  const head = source.replace(/^\uFEFF/, '').trimStart();
  return /^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype[^>]*>\s*)?<svg[\s>]/i.test(head);
};

/**
 * Read intrinsic dimensions from SVG markup.
 * Falls back to the viewBox, then to a sane default of 512×512.
 */
export const svgDimensions = (source: string): { width: number; height: number } => {
  const parse = (value: string | undefined): number | null => {
    if (!value) return null;
    const match = /^\s*([\d.]+)\s*(px)?\s*$/.exec(value);
    if (!match) return null;
    const n = Number.parseFloat(match[1] as string);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const rootMatch = /<svg\b[^>]*>/i.exec(source);
  const root = rootMatch ? rootMatch[0] : '';

  const widthAttr = /\bwidth\s*=\s*["']([^"']+)["']/i.exec(root)?.[1];
  const heightAttr = /\bheight\s*=\s*["']([^"']+)["']/i.exec(root)?.[1];
  const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(root)?.[1];

  const w = parse(widthAttr);
  const h = parse(heightAttr);
  if (w && h) return { width: Math.round(w), height: Math.round(h) };

  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] && parts[3] && parts[2] > 0 && parts[3] > 0) {
      const ratio = (parts[2] as number) / (parts[3] as number);
      if (w) return { width: Math.round(w), height: Math.max(1, Math.round(w / ratio)) };
      if (h) return { width: Math.max(1, Math.round(h * ratio)), height: Math.round(h) };
      return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
    }
  }
  return { width: 512, height: 512 };
};

export class SvgCodec implements ImageCodec {
  readonly encodes = ['svg'] as const;
  readonly decodes = ['svg'] as const;

  async isSupported(): Promise<boolean> {
    return true;
  }

  async init(): Promise<void> {
    await loadSvgo();
  }

  async decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    const source = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    if (!isSvgDocument(source)) {
      throw new EngineError('CORRUPT_IMAGE', 'File does not appear to be an SVG document.');
    }
    const sanitised = await optimiseSvg(source, 1);
    const { width, height } = svgDimensions(sanitised);
    // Vector data has no meaningful pixel representation until rasterised;
    // we return a 1×1 placeholder and let the raster path handle dimensions.
    const imageData = new ImageData(1, 1);
    return {
      imageData,
      width,
      height,
      hasAlpha: true,
      isAnimated: false,
      sourceFormat: 'svg',
      sourceBytes: buffer.byteLength,
    };
  }

  async encode(image: DecodedImage, options: CompressionOptions): Promise<Uint8Array> {
    const raw = (image as DecodedImage & { svgSource?: string }).svgSource;
    if (!raw) {
      throw new EngineError(
        'CONVERSION_FAILED',
        'SVG output requires an SVG source. Raster-to-vector conversion is not supported by PIXIORA.',
      );
    }
    const optimised = await optimiseSvg(raw, options.effort ?? 2);
    return new TextEncoder().encode(optimised);
  }

  async verify(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    const text = new TextDecoder().decode(bytes);
    if (!isSvgDocument(text)) {
      throw new EngineError('VERIFICATION_FAILED', 'Optimised output is not a valid SVG document.');
    }
    // Defence in depth: refuse to hand back markup that still smuggles script.
    if (/<script[\s>]/i.test(text) || /\bon\w+\s*=/i.test(text) || /javascript:/i.test(text)) {
      throw new EngineError('VERIFICATION_FAILED', 'Sanitiser failed to remove active content.');
    }
    const { width, height } = svgDimensions(text);
    return { width, height };
  }
}

/**
 * Rasterise sanitised SVG markup to RGBA using a passive image load.
 * Only receives sanitiser output, and never touches the live DOM.
 */
export const rasteriseSvg = async (
  markup: string,
  width: number,
  height: number,
): Promise<ImageData> => {
  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new EngineError('CONVERSION_FAILED', 'SVG rasterisation is not available in this environment.');
  }
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'sync';
    // No network: sanitised markup contains no external references.
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new EngineError('CONVERSION_FAILED', 'SVG could not be rasterised.'));
      img.src = url;
    });
    return drawableToImageData(img, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
};
