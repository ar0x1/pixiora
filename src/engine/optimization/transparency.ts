/**
 * Transparency analysis.
 *
 * PIXIORA must never silently flatten an alpha channel. Before choosing an
 * output format we measure whether transparency actually exists, and how much
 * of it is *partial* (which matters for GIF's 1-bit alpha).
 */
export interface AlphaProfile {
  readonly hasAlpha: boolean;
  /** Fraction (0–1) of pixels with alpha < 255. */
  readonly transparentRatio: number;
  /** Fraction (0–1) of pixels with 0 < alpha < 255. */
  readonly partialRatio: number;
  /** True when every pixel is either fully opaque or fully transparent. */
  readonly isBinary: boolean;
}

export const analyseAlpha = (data: Uint8ClampedArray): AlphaProfile => {
  const pixels = Math.floor(data.length / 4);
  if (pixels === 0) {
    return { hasAlpha: false, transparentRatio: 0, partialRatio: 0, isBinary: true };
  }

  let transparent = 0;
  let partial = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i] as number;
    if (a < 255) {
      transparent += 1;
      if (a > 0) partial += 1;
    }
  }

  return {
    hasAlpha: transparent > 0,
    transparentRatio: transparent / pixels,
    partialRatio: partial / pixels,
    isBinary: partial === 0,
  };
};

/**
 * Composite RGBA onto a solid background. Required for formats without alpha
 * (JPEG) — we do it explicitly rather than letting the encoder invent a colour.
 */
export const flattenOnto = (
  data: ImageData,
  background: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
): ImageData => {
  const out = new Uint8ClampedArray(data.data.length);
  const src = data.data;
  for (let i = 0; i < src.length; i += 4) {
    const a = (src[i + 3] as number) / 255;
    out[i] = Math.round((src[i] as number) * a + background.r * (1 - a));
    out[i + 1] = Math.round((src[i + 1] as number) * a + background.g * (1 - a));
    out[i + 2] = Math.round((src[i + 2] as number) * a + background.b * (1 - a));
    out[i + 3] = 255;
  }
  return new ImageData(out, data.width, data.height);
};

/** Threshold alpha to 0/255 for binary-alpha formats (GIF). */
export const binariseAlpha = (data: ImageData, threshold = 128): ImageData => {
  const out = new Uint8ClampedArray(data.data);
  for (let i = 3; i < out.length; i += 4) {
    out[i] = (out[i] as number) >= threshold ? 255 : 0;
  }
  return new ImageData(out, data.width, data.height);
};
