import { requireUser } from "@/lib/auth";
import { getSessionsForUser } from "@/lib/sessions";

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
      <h1 className="text-xl font-semibold">Training History</h1>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-600">
          No completed workouts yet. Finish a workout to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded border border-gray-300 p-5"
            >
              <p className="font-medium">{session.workoutTitle}</p>
              <p className="text-sm text-gray-600">
                {session.workoutPrimaryType} ·{" "}
                {session.completedAt.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
