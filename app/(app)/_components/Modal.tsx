"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional one-line caption rendered under the title, inside the header.
   * Wired to the dialog via aria-describedby (not just visual text) so it
   * reads as the dialog's accessible description, same as a native alert
   * dialog's supporting text. Optional and additive — every existing caller
   * (the workout builder's block/item modals, ConfirmModal, EventCard) keeps
   * rendering exactly as before without passing it. */
  description?: string;
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
 *
 * The `<dialog>` element itself carries no `display` utility, on purpose:
 * the UA stylesheet hides a closed dialog via `dialog:not([open]) {
 * display: none }`, a user-agent/normal-priority rule, and in the cascade
 * origin is compared before specificity — an author/normal rule like
 * Tailwind's `flex` always wins over a user-agent/normal one, no matter how
 * much more specific the UA selector is. `flex`/`flex-col` on the dialog
 * itself (a fix once tried here) therefore forced `display: flex` even
 * while closed, permanently overriding the UA's `display: none` — every
 * modal rendered, open or not, and closing one did nothing visible.
 *
 * The dialog is also the *only* scrolling element (`overflow-y-auto` plus
 * the `max-h-[85vh]` that also drives its `inset-0`/`m-auto` centering),
 * and the header is `sticky top-0` rather than a flex item — not a second
 * box with its own cap. Two earlier attempts both put a second sizing
 * constraint on a second element: first a body capped at
 * `calc(85vh - <header height>)`, which only happened to work while the
 * header was exactly one line tall and broke once a `description` wrapped
 * it onto two; then an inner `flex flex-col` wrapper independently capped
 * at the same `max-h-[85vh]`, which overflowed the dialog by exactly its
 * border width, since border-box sizing means the dialog's own 85vh already
 * includes that border and the wrapper's identical 85vh didn't account for
 * it — either way, two boxes each believed they owned the last pixel of
 * height, and the dialog scrolled behind the body on top of the body's own
 * scroll. A percentage height on the wrapper (`h-full`) can't fix that
 * either: this dialog's own height is fundamentally `auto` (content-sized,
 * capped by `max-height`) rather than an explicit length — that's what the
 * `inset-0` + `margin: auto` centering trick requires — and CSS resolves a
 * percentage height against an `auto`-height containing block as `auto`
 * too, so `h-full` would silently do nothing.
 *
 * Sticky positioning needs none of that: there is only one box that
 * scrolls and one box that caps its height, so there is nothing left for a
 * second element to restate or get subtly wrong. `top-0` pins the header to
 * the scrolling dialog's own top edge as the user scrolls; its own
 * `bg-surface-1` (matching the dialog's) keeps the content scrolling
 * beneath it from showing through.
 *
 * `visible pointer-events-auto` on the dialog itself guard against a
 * caller that keeps this component mounted inside a visually-hidden
 * ancestor rather than unmounting it — GoalCardMenu does exactly this
 * (see its own doc comment): its closed panel is `invisible
 * pointer-events-none` rather than removed from the DOM, specifically so
 * the modal a menu item just opened doesn't get unmounted along with the
 * panel closing around it. `visibility` and `pointer-events` are both
 * inherited, and `showModal()`'s top-layer promotion only changes where an
 * element paints, not its computed style — without this reset, a dialog
 * opened from inside such an ancestor would inherit both and render fully
 * visible-looking but unclickable, or not rendered at all. Harmless for
 * every other caller: `visible`/`pointer-events-auto` are already each
 * property's default value, so this changes nothing unless an ancestor is
 * actively fighting it.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const descriptionId = useId();

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
      aria-describedby={description ? descriptionId : undefined}
      // `visible` and `pointer-events-auto` below counter inheritance from
      // a caller that keeps this component mounted inside a visually-hidden
      // ancestor instead of unmounting it on close — GoalCardMenu does this
      // on purpose (its closed panel is `invisible pointer-events-none`,
      // not removed from the DOM, so a menu item's own modal doesn't get
      // unmounted along with the menu closing around it — see
      // GoalCardMenu.tsx's doc comment). `visibility`/`pointer-events` are
      // both inherited, so without resetting them here, a modal opened from
      // inside that closed panel would inherit `invisible
      // pointer-events-none` and render fully open but invisible and
      // unclickable. Removing these two classes would not break anything
      // visibly in this file — it silently breaks GoalCardMenu's Edit
      // instead, elsewhere.
      className="visible fixed inset-0 m-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-0 pointer-events-auto text-ink backdrop:bg-black/50"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-hairline bg-surface-1 p-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description && (
            <p id={descriptionId} className="mt-1 text-sm text-ink-subtle">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-md p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
