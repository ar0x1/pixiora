import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface ImagePickerHandle {
  /** Open the OS file dialog. Used by "Browse" and by "start over" actions. */
  open: () => void;
}

const ACCEPT = '.jpg,.jpeg,.png,.webp,.avif,.gif,.svg,.heic,.heif,.tif,.tiff,image/*';

/**
 * The workspace's one and only file input.
 *
 * It lives at page level rather than inside the drop zone so that a finished
 * workspace can offer "start over with another image" without re-mounting the
 * upload UI — and so there is never more than one `Choose image files` input in
 * the document, which keeps the DOM (and automated selectors) unambiguous.
 *
 * Single-image: no `multiple`. Selecting a file replaces whatever is loaded.
 */
export const ImagePicker = forwardRef<ImagePickerHandle, { onFile: (file: File) => void }>(
  function ImagePicker({ onFile }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({ open: () => inputRef.current?.click() }), []);

    return (
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose image files"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset first: the same file must be selectable again after a replace.
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    );
  },
);
