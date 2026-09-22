import type { Metadata } from "next";
import { X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDayMonthLong } from "@/lib/dates";
import { getSessionsForUser } from "@/lib/sessions";
import { toCalendarDayInTimezone } from "@/lib/timezone";
import { formatDurationSeconds } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import BackLink from "../_components/BackLink";
import {
  resolveBackDestination,
  type BackDestination,
} from "../_components/back-destination";
import ConfirmModal from "../_components/ConfirmModal";
import { PRIMARY_TYPE_LABELS } from "../workouts/primary-type-labels";
import { deleteAllSessions, deleteSession } from "./actions";
import FinishedNotice from "./FinishedNotice";
import { PAGE_MAIN_CLASSES, PANEL_CLASSES_COMPACT } from "../_components/shared-classes";

export const metadata: Metadata = {
  title: "History",
};

const DEFAULT_BACK: BackDestination = {
  href: "/workouts",
  label: "My Workouts",
};

/** Where the `from` search param can send the back link, keyed by the value
 * each entry point passes — see resolveBackDestination for why `from` is
 * looked up here rather than trusted directly. */
const BACK_SOURCES: Record<string, BackDestination> = {
  home: { href: "/", label: "Home" },
};

/**
 * History: the authenticated user's completed workout sessions, most
 * recently completed first. Renders workout_title and workout_primary_type
 * from each session's own snapshot columns rather than joining against
 * `workouts`, so a session survives its workout being edited or deleted. A
 * row shows the title, "type · date", and the active duration when the
 * session has one (only the Start flow measures it).
 *
 * Reachable from /workouts (its corner button), Home (the recent-sessions
 * "Full history" link) and a workout's detail page (`from=workout&workout=
 * <id>`, the only entry point whose destination carries an id — validated
 * inside resolveBackDestination), so the back link's target depends on the
 * `from` search param each sets — see BACK_SOURCES/DEFAULT_BACK.
 *
 * `?finished=1` marks a landing from Start Workout Mode's Finish button
 * (StartWorkoutClient) — the only entry point that ever sets it, so
 * FinishedNotice only shows right after finishing a workout, never on a
 * plain visit to /history. It names the newest session, which is the one
 * Finish just wrote. A distinct value from `?saved=1` (used by
 * /workouts/[id] and /profile) since the label here is "Finished".
 */
export default async function HistoryPage(props: PageProps<"/history">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const back = resolveBackDestination(
    searchParams.from,
    BACK_SOURCES,
    DEFAULT_BACK,
    searchParams.workout
  );
  const finished =
    (Array.isArray(searchParams.finished)
      ? searchParams.finished[0]
      : searchParams.finished) === "1";
  const { timezone } = await getUserContext(user.id);
  const sessions = await getSessionsForUser(user.id);
  const newest = sessions[0];

  return (
    <main className={PAGE_MAIN_CLASSES}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <BackLink href={back.href} label={back.label} />
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink sm:text-page-title-compact">
            History
          </h1>
        </div>

        {sessions.length > 0 && (
          <div className="shrink-0">
            <ConfirmModal
              trigger="Clear history"
              triggerClassName="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-danger hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              title="Clear all history?"
              description={`${
                sessions.length === 1
                  ? "Your only session"
                  : `All ${sessions.length} sessions`
              } will be deleted and Stats will be empty. Your workouts stay in the library. This cannot be undone.`}
              cancelLabel="Keep my history"
              confirmLabel="Clear history"
              pendingLabel="Clearing…"
              action={deleteAllSessions}
            />
          </div>
        )}
      </div>

      {newest && (
        <FinishedNotice
          show={finished}
          title={newest.workoutTitle}
          nonce={newest.id}
        />
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          Finishing a workout writes a session here.
        </p>
      ) : (
        <section className={PANEL_CLASSES_COMPACT}>
          <h2 className="text-section font-semibold text-ink">
            Sessions
          </h2>

          <ul className="flex flex-col">
            {sessions.map((session) => {
              const date = formatDayMonthLong(
                toCalendarDayInTimezone(session.completedAt, timezone)
              );

              return (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 border-b border-surface-3 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-ink">
                      {session.workoutTitle}
                    </p>
                    <p className="text-xs text-ink-tertiary">
                      {PRIMARY_TYPE_LABELS[session.workoutPrimaryType].label} ·{" "}
                      {date}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {session.durationSeconds != null && (
                      <span className="text-[13px] font-medium text-ink-muted">
                        {formatDurationSeconds(session.durationSeconds)}
                      </span>
                    )}
                    <ConfirmModal
                      trigger={<X className="h-4 w-4" aria-hidden="true" />}
                      triggerClassName="flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-danger active:bg-surface-2 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                      triggerAriaLabel="Delete session"
                      title="Delete this session?"
                      description={`${session.workoutTitle}, ${date}. Stats will be recalculated without it.`}
                      cancelLabel="Keep it"
                      confirmLabel="Delete session"
                      action={deleteSession.bind(null, session.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
