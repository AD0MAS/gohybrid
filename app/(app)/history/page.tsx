import { X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSessionsForUser } from "@/lib/sessions";
import ConfirmModal from "../_components/ConfirmModal";
import { deleteSession } from "./actions";

/**
 * Training History: a chronological list of the authenticated user's
 * completed workout sessions, most recently completed first. Renders
 * workout_title and workout_primary_type from each session's own snapshot
 * columns rather than joining against `workouts`, so a session survives
 * its workout being edited or deleted (see GOHYBRID_PLAN.md §7).
 */
export default async function HistoryPage() {
  const user = await requireUser();
  const sessions = await getSessionsForUser(user.id);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-xl font-semibold text-ink">Training History</h1>

      {sessions.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          No completed workouts yet. Finish a workout to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-2 rounded border border-hairline bg-surface-1 p-5"
            >
              <div>
                <p className="font-medium text-ink">{session.workoutTitle}</p>
                <p className="text-sm text-ink-subtle">
                  {session.workoutPrimaryType} ·{" "}
                  {session.completedAt.toLocaleString()}
                </p>
              </div>

              <ConfirmModal
                trigger={<X className="h-4 w-4" aria-hidden="true" />}
                triggerClassName="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                triggerAriaLabel="Delete"
                title="Delete session"
                description="Deleting this session removes it from training history and from all stats. If it completed a scheduled workout, that workout goes back to Planned."
                confirmLabel="Delete"
                action={deleteSession.bind(null, session.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
