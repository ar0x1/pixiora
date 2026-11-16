import { create } from 'zustand';
import type { CompressionOptions, CompressionResult } from '@/types/compression';
import type { DecodedImage, ImportedFormat } from '@/types/image';
import type { FileDescriptor } from '@/types/image';
import { createObjectUrl, revokeObjectUrl } from '@/utils/objectUrl';

/**
 * Image store — a single-slot record for the image in the workspace.
 *
 * The app is deliberately single-image: one workspace, one file. `addImages`
 * replaces whatever was loaded (and revokes its object URLs) instead of
 * appending, which keeps every downstream view trivially unambiguous.
 *
 * Memory discipline:
 * - `originalUrl` is an object URL, revoked whenever the record is removed or
 *   replaced. Previews always come from the (already compressed) output blob,
 *   never from a re-encode.
 * - `fileBytes` is kept because retrying a job must not require re-reading the
 *   File from disk (which can fail if the user moved it).
 * - Decoded pixel data is NOT stored here: it lives only inside the worker for
 *   the duration of a job. Holding RGBA for 20 files would cost gigabytes.
 */

export interface PixioraImage {
  readonly id: string;
  readonly file: File;
  readonly name: string;
  readonly descriptor: FileDescriptor;
  /** Copy of the source bytes: needed for retries and worker transfers. */
  readonly fileBytes: ArrayBuffer;
  readonly previewUrl: string;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly isAnimated: boolean;
  readonly addedAt: number;
  /** Output of the most recent successful compression. */
  result?: CompressionResult;
  resultUrl?: string;
  /** Per-image option overrides; falls back to global settings. */
  overrides?: Partial<CompressionOptions>;
  /** Decoded metadata kept only for the currently previewed image. */
  decoded?: Pick<DecodedImage, 'width' | 'height' | 'hasAlpha' | 'isAnimated'>;
  error?: { code: string; message: string };
}

interface ImageState {
  images: PixioraImage[];
  activeId: string | null;
  addImages: (entries: NewImageEntry[]) => void;
  removeImage: (id: string) => void;
  clearAll: () => void;
  setActive: (id: string | null) => void;
  setResult: (id: string, result: CompressionResult) => void;
  setError: (id: string, error: { code: string; message: string } | undefined) => void;
  setOverrides: (id: string, overrides: Partial<CompressionOptions>) => void;
  resetResult: (id: string) => void;
}

export interface NewImageEntry {
  readonly file: File;
  readonly descriptor: FileDescriptor;
  readonly fileBytes: ArrayBuffer;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly isAnimated: boolean;
}

let idCounter = 0;
const nextId = (): string => `img_${Date.now().toString(36)}_${(idCounter += 1).toString(36)}`;

export const useImageStore = create<ImageState>((set, get) => ({
  images: [],
  activeId: null,

  addImages: (entries) => {
    // A workspace holds exactly ONE image. Adding another replaces the current
    // one rather than growing a list, so previews, results and the action rail
    // can never refer to a file the user is not looking at.
    if (entries.length === 0) return;
    const created: PixioraImage[] = entries.slice(0, 1).map((entry) => ({
      id: nextId(),
      file: entry.file,
      name: entry.file.name,
      descriptor: entry.descriptor,
      fileBytes: entry.fileBytes,
      previewUrl: createObjectUrl(entry.file),
      width: entry.width,
      height: entry.height,
      hasAlpha: entry.hasAlpha,
      isAnimated: entry.isAnimated,
      addedAt: Date.now(),
      decoded: {
        width: entry.width,
        height: entry.height,
        hasAlpha: entry.hasAlpha,
        isAnimated: entry.isAnimated,
      },
    }));
    // Free the outgoing record's object URLs before dropping the reference.
    const previous = get().images;
    for (const image of previous) {
      revokeObjectUrl(image.previewUrl);
      revokeObjectUrl(image.resultUrl);
    }
    set({ images: created, activeId: created[0]?.id ?? null });
  },

  removeImage: (id) => {
    const target = get().images.find((image) => image.id === id);
    if (target) {
      revokeObjectUrl(target.previewUrl);
      revokeObjectUrl(target.resultUrl);
    }
    set((state) => {
      const images = state.images.filter((image) => image.id !== id);
      const activeId = state.activeId === id ? (images[0]?.id ?? null) : state.activeId;
      return { images, activeId };
    });
  },

  clearAll: () => {
    for (const image of get().images) {
      revokeObjectUrl(image.previewUrl);
      revokeObjectUrl(image.resultUrl);
    }
    set({ images: [], activeId: null });
  },

  setActive: (id) => set({ activeId: id }),

  setResult: (id, result) =>
    set((state) => ({
      images: state.images.map((image) => {
        if (image.id !== id) return image;
        revokeObjectUrl(image.resultUrl); // free the previous output first
        return { ...image, result, resultUrl: createObjectUrl(result.blob), error: undefined };
      }),
    })),

  setError: (id, error) =>
    set((state) => ({
      images: state.images.map((image) => (image.id === id ? { ...image, error } : image)),
    })),

  setOverrides: (id, overrides) =>
    set((state) => ({
      images: state.images.map((image) =>
        image.id === id ? { ...image, overrides: { ...image.overrides, ...overrides } } : image,
      ),
    })),

  resetResult: (id) =>
    set((state) => ({
      images: state.images.map((image) => {
        if (image.id !== id) return image;
        revokeObjectUrl(image.resultUrl);
        return { ...image, result: undefined, resultUrl: undefined, error: undefined };
      }),
    })),
}));

export const selectActiveImage = (state: ImageState): PixioraImage | null =>
  state.images.find((image) => image.id === state.activeId) ?? null;

export type { ImportedFormat };
