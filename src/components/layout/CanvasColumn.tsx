import type { ReactNode } from 'react';
import { ImagePreview } from '@/components/editor/ImagePreview';
import { FileChip } from '@/components/workspace/FileChip';
import { UploadZone } from '@/components/workspace/UploadZone';
import type { PixioraImage } from '@/store/imageStore';

export interface CanvasColumnProps {
  image: PixioraImage | null;
  uploading: boolean;
  onBrowse: () => void;
  onFile: (file: File) => void;
  onRemove: () => void;
  /** Verb phrase for this workspace, e.g. "Compress an image". */
  emptyTitle: string;
  /** Progress / error / result nodes, stacked under the viewer. */
  status?: ReactNode;
}

/**
 * The editor column — identical in both workspaces.
 *
 * Two states only:
 *  1. Empty → the drop target is the whole column. It is the only upload
 *     affordance in the app.
 *  2. Loaded → file strip, viewer, status. The drop target is gone, because
 *     there is nothing to add to: a workspace holds one image.
 */
export const CanvasColumn = ({
  image,
  uploading,
  onBrowse,
  onFile,
  onRemove,
  emptyTitle,
  status,
}: CanvasColumnProps) => (
  <div className="flex min-w-0 flex-col gap-3.5">
    {image ? (
      <div className="panel overflow-hidden">
        <div className="border-b border-line">
          <FileChip image={image} onRemove={onRemove} />
        </div>
        <div className="p-3">
          <ImagePreview image={image} />
        </div>
      </div>
    ) : (
      <UploadZone
        onBrowse={onBrowse}
        onFile={onFile}
        busy={uploading}
        title={emptyTitle}
      />
    )}

    {status}
  </div>
);
