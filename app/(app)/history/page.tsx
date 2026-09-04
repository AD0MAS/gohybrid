import { X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatRelativeDay } from "@/lib/dates";
import { getSessionsForUser } from "@/lib/sessions";
import { toCalendarDayInTimezone, toClockTimeInTimezone } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";
import BackLink from "../_components/BackLink";
import {
  resolveBackDestination,
  type BackDestination,
} from "../_components/back-destination";
import ConfirmModal from "../_components/ConfirmModal";
import { deleteAllSessions, deleteSession } from "./actions";

const DEFAULT_BACK: BackDestination = {
  href: "/workouts/library",
  label: "My Workouts",
};

/** Where the `from` search param can send the back link, keyed by the value
 * each entry point passes — see resolveBackDestination for why `from` is
 * looked up here rather than trusted directly. */
const BACK_SOURCES: Record<string, BackDestination> = {
  home: { href: "/", label: "Home" },
};

/**
 * Training History: a chronological list of the authenticated user's
 * completed workout sessions, most recently completed first. Renders
 * workout_title and workout_primary_type from each session's own snapshot
 * columns rather than joining against `workouts`, so a session survives
 * its workout being edited or deleted (see GOHYBRID_PLAN.md §7).
 *
 * Reachable from both /workouts/library (its corner button) and Home (the
 * recent-activity "Full history" link), so the back link's target depends
 * on the `from` search param each sets — see BACK_SOURCES/DEFAULT_BACK.
 */
export default async function HistoryPage(props: PageProps<"/history">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const back = resolveBackDestination(searchParams.from, BACK_SOURCES, DEFAULT_BACK);
  const { today, timezone } = await getUserContext(user.id);
  const sessions = await getSessionsForUser(user.id);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BackLink href={back.href} label={back.label} />
          <h1 className="text-xl font-semibold text-ink">Training History</h1>
        </div>

        {sessions.length > 0 && (
          <ConfirmModal
            trigger="Clear history"
            triggerClassName="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-danger hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            title="Clear history"
            description="Deleting every session removes all training history and empties your stats and the activity heatmap. Workouts completed without being planned disappear from the calendar; planned workouts revert to Planned."
            confirmLabel="Delete"
            action={deleteAllSessions}
          />
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          No completed workouts yet. Finish a workout to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-1 p-5"
            >
              <div>
                <p className="font-medium text-ink">{session.workoutTitle}</p>
                <p className="text-sm text-ink-subtle">
                  {session.workoutPrimaryType} ·{" "}
                  {formatRelativeDay(
                    toCalendarDayInTimezone(session.completedAt, timezone),
                    today
                  )}{" "}
                  · {toClockTimeInTimezone(session.completedAt, timezone)}
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
