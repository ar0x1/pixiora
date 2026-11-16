/**
 * Ambient declarations for untyped CJS dependencies.
 *
 * These are deliberately narrow: only the members PIXIORA actually calls are
 * declared, so accidental use of undocumented internals fails at compile time.
 */

declare module 'gifenc' {
  export interface GifFrameOptions {
    palette?: number[][];
    delay?: number;
    dispose?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
  }
  export function GIFEncoder(opts?: Record<string, unknown>): {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): number[][];
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}

declare module 'utif' {
  interface Ifd {
    width?: number;
    height?: number;
    [key: string]: unknown;
  }
  const UTIF: {
    decode(buffer: ArrayBuffer): Ifd[];
    decodeImage(buffer: ArrayBuffer, ifd: Ifd, ifds?: Ifd[]): void;
    toRGBA8(ifd: Ifd): Uint8Array;
  };
  export default UTIF;
}

declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    has_alpha_channel?(): boolean;
    display(
      data: { data: Uint8ClampedArray; width: number; height: number },
      callback: (result: { data: Uint8ClampedArray } | null) => void,
    ): void;
  }
  interface LibHeif {
    HeifDecoder: new () => { decode(buffer: Uint8Array): HeifImage[] };
  }
  const factory: () => Promise<LibHeif>;
  export default factory;
}
