/**
 * Metadata handling.
 *
 * Sequence matters (spec §5): EXIF orientation must be *applied to pixels*
 * before any metadata stripping, otherwise rotated phone photos come out
 * sideways once the tag is gone.
 */
import { createCanvas } from '@/engine/optimization/canvas';

export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ExifInfo {
  readonly orientation: Orientation;
  readonly byteSize: number;
}

const ORIENTATION_TAG = 0x0112;

/**
 * Minimal, dependency-free EXIF orientation reader.
 * Walks the TIFF header inside a JPEG APP1 segment (or a RAW TIFF header).
 * Returns orientation 1 when absent/unparsable — never throws.
 */
export const readExifOrientation = (bytes: Uint8Array): ExifInfo => {
  try {
    // JPEG: find APP1 "Exif\0\0"
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      while (offset + 4 < bytes.length) {
        if (bytes[offset] !== 0xff) break;
        const marker = bytes[offset + 1] as number;
        const length = ((bytes[offset + 2] as number) << 8) | (bytes[offset + 3] as number);
        if (marker === 0xe1) {
          const seg = bytes.subarray(offset + 4, offset + 2 + length);
          if (seg[0] === 0x45 && seg[1] === 0x78 && seg[2] === 0x69 && seg[3] === 0x66) {
            const parsed = parseTiffOrientation(seg.subarray(6));
            return { orientation: parsed.orientation, byteSize: length };
          }
        }
        if (marker === 0xda) break; // start of scan: no more metadata
        offset += 2 + length;
      }
      return { orientation: 1, byteSize: 0 };
    }
    // TIFF container
    if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d)) {
      const info = parseTiffOrientation(bytes);
      return { orientation: info.orientation, byteSize: 0 };
    }
  } catch {
    /* malformed EXIF must never break decoding */
  }
  return { orientation: 1, byteSize: 0 };
};

const parseTiffOrientation = (tiff: Uint8Array): ExifInfo => {
  if (tiff.length < 8) return { orientation: 1, byteSize: 0 };
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const u16 = (o: number) => (little
    ? (tiff[o] as number) | ((tiff[o + 1] as number) << 8)
    : ((tiff[o] as number) << 8) | (tiff[o + 1] as number));
  const u32 = (o: number) => (little
    ? ((tiff[o] as number) | ((tiff[o + 1] as number) << 8) | ((tiff[o + 2] as number) << 16) | ((tiff[o + 3] as number) << 24)) >>> 0
    : (((tiff[o] as number) << 24) | ((tiff[o + 1] as number) << 16) | ((tiff[o + 2] as number) << 8) | (tiff[o + 3] as number)) >>> 0);

  const ifdOffset = u32(4);
  if (ifdOffset + 2 > tiff.length) return { orientation: 1, byteSize: 0 };
  const count = u16(ifdOffset);
  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > tiff.length) break;
    if (u16(entry) === ORIENTATION_TAG) {
      const value = u16(entry + 8);
      if (value >= 1 && value <= 8) return { orientation: value as Orientation, byteSize: 0 };
    }
  }
  return { orientation: 1, byteSize: 0 };
};

/** Does this orientation transpose width/height? */
export const orientationSwapsAxes = (o: Orientation): boolean => o >= 5 && o <= 8;

/**
 * Apply EXIF orientation by drawing a transformed copy.
 * Implemented with canvas transforms so it is exact (no resampling artefacts).
 */
export const applyOrientation = (data: ImageData, orientation: Orientation): ImageData => {
  if (orientation === 1) return data;
  const swap = orientationSwapsAxes(orientation);
  const w = data.width;
  const h = data.height;
  const outW = swap ? h : w;
  const outH = swap ? w : h;

  const source = createCanvas(w, h);
  const sctx = source.getContext('2d');
  if (!sctx) return data;
  sctx.putImageData(data, 0, 0);

  const target = createCanvas(outW, outH);
  const tctx = target.getContext('2d');
  if (!tctx) return data;

  switch (orientation) {
    case 2: tctx.translate(outW, 0); tctx.scale(-1, 1); break;              // mirror horizontal
    case 3: tctx.translate(outW, outH); tctx.rotate(Math.PI); break;        // 180
    case 4: tctx.translate(0, outH); tctx.scale(1, -1); break;              // mirror vertical
    case 5: tctx.rotate(0.5 * Math.PI); tctx.scale(1, -1); break;           // transpose
    case 6: tctx.rotate(0.5 * Math.PI); tctx.translate(0, -outH); break;    // 90 CW
    case 7: tctx.rotate(0.5 * Math.PI); tctx.translate(outW, -outH); tctx.scale(-1, 1); break;
    case 8: tctx.rotate(-0.5 * Math.PI); tctx.translate(-outW, 0); break;   // 90 CCW
    default: break;
  }
  tctx.drawImage(source as unknown as CanvasImageSource, 0, 0);
  return tctx.getImageData(0, 0, outW, outH);
};
