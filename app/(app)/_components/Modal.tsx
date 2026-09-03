"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/**
 * A centred modal built on the native <dialog> element rather than a
 * hand-rolled fixed-inset div: showModal() gives Escape-to-close, focus
 * trapping and ::backdrop dimming from the platform instead of behaviour
 * we'd have to maintain ourselves. `open` is the only source of truth — the
 * effect below calls showModal()/close() to bring the native element in
 * sync with it, and the dialog's own native "close" event (fired by
 * Escape, the close button below, or a backdrop click) calls back into
 * onClose so the parent's state can never drift from what's on screen.
 * Centering and the max width are set explicitly with Tailwind classes
 * rather than relied on from the UA stylesheet, since Tailwind's preflight
 * reset is not guaranteed to leave dialog's default margin untouched.
 */
export default function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[85vh] w-full max-w-lg rounded-lg border border-hairline bg-surface-1 p-0 text-ink backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-hairline p-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[calc(85vh-4rem)] overflow-y-auto p-6">
        {children}
      </div>
    </dialog>
  );
}
