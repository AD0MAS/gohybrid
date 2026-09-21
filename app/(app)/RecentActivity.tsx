import Link from "next/link";
import { formatRelativeDay } from "@/lib/dates";
import { getRecentSessionsForUser } from "@/lib/sessions";
import { toCalendarDayInTimezone } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";
import { SECTION_BUTTON_CLASSES } from "./_components/section-button";

const RECENT_ACTIVITY_LIMIT = 3;

type RecentActivityProps = {
  userId: string;
};

/**
 * Home's recent sessions: the last 3 completed workout sessions, newest
 * first, read-only, with a full-width "Full history" button under them. Renders workout_title and workout_primary_type from
 * each session's own snapshot columns, same as
 * /history — but this is a fixed three-row list with no actions,
 * not the full chronological list, so it stays its own component rather
 * than a shared one with /history. `userId` arrives as a prop from Home
 * rather than a local requireUser() call — same pattern as /stats.
 */
export default async function RecentActivity({ userId }: RecentActivityProps) {
  const { today, timezone } = await getUserContext(userId);
  const sessions = await getRecentSessionsForUser(
    userId,
    RECENT_ACTIVITY_LIMIT
  );

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface-1 p-5">
      <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
        Recent sessions
      </h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          No completed workouts yet. Finish a workout to see it here.
        </p>
      ) : (
        <ul className="flex flex-col">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-3 border-b border-surface-3 py-3 last:border-b-0"
            >
              <p className="min-w-0 break-words text-sm font-medium text-ink">
                {session.workoutTitle}
              </p>
              <p className="shrink-0 text-xs text-ink-tertiary">
                {session.workoutPrimaryType} ·{" "}
                {formatRelativeDay(
                  toCalendarDayInTimezone(session.completedAt, timezone),
                  today
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Link href="/history?from=home" className={SECTION_BUTTON_CLASSES}>
        Full history
      </Link>
    </section>
  );
}
