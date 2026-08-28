import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getRecentSessionsForUser } from "@/lib/sessions";

const RECENT_ACTIVITY_LIMIT = 5;

/**
 * Home's recent activity: the last 5 completed workout sessions, newest
 * first, read-only. Renders workout_title and workout_primary_type from
 * each session's own snapshot columns (GOHYBRID_PLAN.md §7), same as
 * Training History — but this is a fixed five-row list with no actions,
 * not the full chronological list, so it stays its own component rather
 * than a shared one with /history.
 */
export default async function RecentActivity() {
  const user = await requireUser();
  const sessions = await getRecentSessionsForUser(
    user.id,
    RECENT_ACTIVITY_LIMIT
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">Recent activity</h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          No completed workouts yet. Finish a workout to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded border border-hairline bg-surface-1 p-5"
            >
              <p className="font-medium text-ink">{session.workoutTitle}</p>
              <p className="text-sm text-ink-subtle">
                {session.workoutPrimaryType} ·{" "}
                {session.completedAt.toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/history"
        className="flex h-11 w-fit items-center justify-center self-end rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        Full history
      </Link>
    </section>
  );
}
