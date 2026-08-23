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
        className="text-sm text-red-700 underline"
      >
        Delete
      </button>

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-w-sm flex-col gap-4 rounded bg-white p-4">
            <p className="text-sm">
              Delete this workout? Its blocks and items are deleted with
              it. Any completed sessions from this workout stay in your
              training history.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-sm underline"
              >
                Cancel
              </button>

              <form action={deleteAction}>
                <button
                  type="submit"
                  className="rounded bg-red-700 px-3 py-2 text-sm text-white"
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
