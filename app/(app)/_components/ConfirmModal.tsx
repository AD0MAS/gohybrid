"use client";

import { useState, type ReactNode } from "react";
import { SubmitButton } from "@/app/_components/FormStatus";
import Modal from "./Modal";

type ConfirmModalBaseProps = {
  trigger: ReactNode;
  triggerClassName: string;
  triggerAriaLabel?: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** Label of the quiet cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** "danger" (default) fills the confirm button in the danger colour, for
   * destructive actions; "primary" uses the accent, for a confirmation that
   * destroys nothing (Start's "Finish anyway?"). */
  variant?: "danger" | "primary";
  /** Disables the trigger, e.g. while the confirmed action is running. */
  triggerDisabled?: boolean;
};

/**
 * What confirming does — exactly one of two, never both:
 * - `action`: a Server Action (already bound to its id), run as a <form
 *   action>. The only kind a Server Component can pass, since it is
 *   serializable.
 * - `onConfirm`: a client-only callback, run from a plain button's onClick
 *   after the modal closes. For a caller that shows the action's progress on
 *   the page itself (Start's "Finishing…" banner), which a form action can't
 *   do: see StartWorkoutClient.
 */
type ConfirmModalProps = ConfirmModalBaseProps &
  (
    | { action: () => Promise<void>; onConfirm?: never }
    | { onConfirm: () => void; action?: never }
  );

const CONFIRM_CLASSES: Record<NonNullable<ConfirmModalProps["variant"]>, string> = {
  danger:
    "flex h-11 items-center justify-center rounded-control bg-danger px-5 text-base text-white hover:bg-danger-hover active:bg-danger-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus",
  primary:
    "flex h-11 items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus",
};

/**
 * A quiet trigger that opens a Modal (see ./Modal.tsx) asking the user to
 * confirm an action, with a filled confirm button (danger by default, accent
 * with `variant="primary"`) and a quiet-secondary cancel. `action` is a Server
 * Action already bound to whatever id it needs (e.g.
 * `deleteSession.bind(null, id)`) — this component only wires it to a <form>,
 * the same convention as every other delete button in the app
 * (BodyMetricsList, PersonalRecordsList). A client caller may pass `onConfirm`
 * instead (see ConfirmModalProps).
 * `trigger` accepts arbitrary content (a label, an icon) rather than a
 * label string, since callers now open this from an icon-only delete
 * button as well as from text triggers — pass `triggerAriaLabel` whenever
 * `trigger` carries no visible text of its own. Extracted here rather than
 * repeated inline because /history's delete confirmation was the second
 * place needing this exact trigger+confirm+cancel shape (after the
 * workout detail page's own hand-rolled version, since migrated to this
 * component).
 */
export default function ConfirmModal({
  trigger,
  triggerClassName,
  triggerAriaLabel,
  title,
  description,
  confirmLabel,
  action,
  onConfirm,
  cancelLabel = "Cancel",
  variant = "danger",
  triggerDisabled = false,
}: ConfirmModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={triggerDisabled}
        className={triggerClassName}
        aria-label={triggerAriaLabel}
      >
        {trigger}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">{description}</p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              {cancelLabel}
            </button>

            {onConfirm ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
                className={CONFIRM_CLASSES[variant]}
              >
                {confirmLabel}
              </button>
            ) : (
              <form action={action}>
                <SubmitButton className={CONFIRM_CLASSES[variant]}>
                  {confirmLabel}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
