import { useCallback, useRef, useState } from 'react';
import { FolderOpen, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export interface UploadZoneProps {
  /** Opens the workspace's file dialog (owned by <ImagePicker />). */
  onBrowse: () => void;
  /** Receives a dropped file. Capped at one by design. */
  onFile?: (file: File) => void;
  busy?: boolean;
  /** Title for this workspace, e.g. "Compress an image" / "Convert an image". */
  title: string;
}

/**
 * The workspace's empty state: a drop target, and nothing else.
 *
 * There is no "add more" variant. Once an image is loaded this component is not
 * rendered at all — a workspace holds one image, and the only way to bring in
 * another one is the explicit "start over" action offered after an operation
 * finishes.
 *
 * The headline is set in the display serif at a real size: an empty workspace is
 * the one screen with room for a voice, so it gets one. Below it: the drop
 * affordance and nothing else — no eyebrow label, no tagline, no format list.
 *
 * Accessibility: a real drop region, drag state announced via aria-live, and a
 * normal keyboard-reachable button (the file input itself lives in <ImagePicker/>
 * so the document only ever has one).
 */
export const UploadZone = ({ onBrowse, onFile, busy = false, title }: UploadZoneProps) => {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      // Hard cap at one: a multi-file drop must not silently pick the last file.
      const file = list?.[0];
      if (file) onFile?.(file);
    },
    [onFile],
  );

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        'relative flex min-h-[clamp(420px,calc(100dvh-15rem),820px)] flex-col overflow-hidden rounded-lg border border-dashed transition-colors duration-150',
        dragging
          ? 'border-accent-soft/60 bg-accent/[0.06]'
          : 'border-white/[0.14] bg-white/[0.014] hover:border-white/25',
      )}
    >
      {/* Canvas texture: fades out towards the edges so it never competes with copy. */}
      <span
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_78%)]"
      />

      {/* Drop surface */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <div
          className={cn(
            'mb-5 flex size-12 items-center justify-center rounded-md border border-line bg-white/[0.03] text-ink-muted shadow-inset transition-colors',
            dragging && 'border-accent-soft/50 text-accent-soft',
          )}
          aria-hidden
        >
          {dragging ? <ImagePlus className="size-5" /> : <FolderOpen className="size-5" />}
        </div>

        <h2 className="display max-w-[460px] text-[30px] sm:text-[34px]">
          {dragging ? 'Drop the image' : title}
        </h2>

        <div className="mt-6 flex items-center gap-2.5">
          <Button
            size="lg"
            variant="secondary"
            icon={<FolderOpen className="size-3.5" aria-hidden />}
            loading={busy}
            onClick={onBrowse}
          >
            Browse files
          </Button>
          <span className="text-[11.5px] text-ink-muted">or drop it here</span>
        </div>
      </div>

      <span aria-live="polite" className="sr-only">
        {dragging ? 'Drop the file to load it into the workspace.' : ''}
      </span>
    </div>
  );
};
