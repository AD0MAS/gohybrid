"use client";

import { useState } from "react";

type DeleteWorkoutModalProps = {
  deleteAction: () => Promise<void>;
};

/**
 * Delete-confirmation modal for the workout detail page. Client-only
 * because it needs open/closed state — the actual delete Server Action is
 * passed in as a prop from the (Server Component) page rather than
 * imported and called here, keeping the client boundary limited to just
 * the modal's visibility toggle.
 */
export default function DeleteWorkoutModal({
  deleteAction,
}: DeleteWorkoutModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        Delete
      </button>

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-w-sm flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-5">
            <p className="text-sm text-ink">
              Delete this workout? Its blocks and items are deleted with
              it. Any completed sessions from this workout stay in your
              training history.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              >
                Cancel
              </button>

              <form action={deleteAction}>
                <button
                  type="submit"
                  className="flex h-11 items-center justify-center rounded-md bg-danger px-4 text-base text-white hover:bg-danger-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
