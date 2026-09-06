"use client";

import { useState, type ReactNode } from "react";
import { SubmitButton } from "@/app/_components/FormStatus";
import Modal from "./Modal";

type ConfirmModalProps = {
  trigger: ReactNode;
  triggerClassName: string;
  triggerAriaLabel?: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

/**
 * A quiet trigger that opens a Modal (see ./Modal.tsx) asking the user to
 * confirm a destructive action, with a filled-danger confirm button and a
 * quiet-secondary cancel. `action` is a Server Action already bound to
 * whatever id it needs (e.g. `deleteSession.bind(null, id)`) — this
 * component only wires it to a <form>, the same convention as every other
 * delete button in the app (BodyMetricsList, PersonalRecordsList).
 * `trigger` accepts arbitrary content (a label, an icon) rather than a
 * label string, since callers now open this from an icon-only delete
 * button as well as from text triggers — pass `triggerAriaLabel` whenever
 * `trigger` carries no visible text of its own. Extracted here rather than
 * repeated inline because /history's delete confirmation was the second
 * place needing this exact trigger+confirm+cancel shape (after the
 * workout detail page's own hand-rolled version, since migrated to this
 * component) — see GOHYBRID_PLAN.md step 32.11.
 */
export default function ConfirmModal({
  trigger,
  triggerClassName,
  triggerAriaLabel,
  title,
  description,
  confirmLabel,
  action,
}: ConfirmModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
              className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              Cancel
            </button>

            <form action={action}>
              <SubmitButton className="flex h-11 items-center justify-center rounded-md bg-danger px-4 text-base text-white hover:bg-danger-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
                {confirmLabel}
              </SubmitButton>
            </form>
          </div>
        </div>
      </Modal>
    </>
  );
}
