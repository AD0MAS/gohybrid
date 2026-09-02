"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  getScheduledWorkoutForUser,
  markSkippedForUser,
  unscheduleForUser,
} from "@/lib/scheduled-workouts";
import { createSessionForWorkout } from "@/lib/sessions";
import { toNoonInstant } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";

/**
 * Sets is_skipped on one of the authenticated user's scheduled workouts,
 * bound with the id (and the target value) via .bind(null, id, isSkipped)
 * from UpcomingList and from WeekStrip's day cards. Ownership is enforced
 * by markSkippedForUser's WHERE clause. Throws if nothing matched, so a
 * forged id can't silently no-op. Revalidates /workouts and / (Home) — the
 * pages that render UpcomingList and WeekStrip.
 */
export async function markScheduledWorkoutSkipped(
  id: string,
  isSkipped: boolean
) {
  const user = await requireUser();

  const updated = await markSkippedForUser(id, user.id, isSkipped);

  if (!updated) {
    throw new Error("Scheduled workout not found.");
  }

  revalidatePath("/workouts");
  revalidatePath("/");
}

/**
 * Records that one of the authenticated user's scheduled workouts was
 * actually done — bound with the id via .bind(null, id) from the "Mark
 * done" control on both UpcomingList and WeekStrip's day cards, for a
 * workout completed away from Start Workout Mode (GOHYBRID_PLAN.md §1: the
 * core loop's "After" moment doesn't require having run "During" through
 * this app). Reuses createSessionForWorkout, the same lib/ function
 * finishWorkout goes through, so the created session has the identical
 * shape (snapshot columns, no status field) regardless of entry point.
 *
 * The session's completed_at depends on which day is being completed:
 * - entry.scheduledDate is today (in the user's timezone) → now(), the real
 *   completion instant, since it's genuinely known.
 * - otherwise (a past-dated plan) → noon on the entry's own scheduledDate
 *   (toNoonInstant, lib/timezone.ts), because the actual time of day is
 *   unknown, and stamping it with the current instant would put a workout
 *   actually done on Tuesday into Thursday's heatmap cell and streak the
 *   moment this button is clicked days later.
 *
 * `today` comes from getUserContext, the same source already used below for
 * `timezone` — never computed separately, so this comparison and
 * toNoonInstant always agree on what day it is.
 *
 * Links directly to this exact scheduled_workouts id (SessionLinkTarget's
 * "specific" case) rather than searching by date — unlike finishWorkout,
 * the entry is already known, so there's no same-day ambiguity to resolve
 * (e.g. the same workout scheduled twice in one day). Throws if the entry
 * doesn't exist/isn't owned, or is already linked to a session, so a stale
 * page or a double click can't create a duplicate session for one plan.
 */
export async function markScheduledWorkoutDone(id: string) {
  const user = await requireUser();

  const entry = await getScheduledWorkoutForUser(id, user.id);
  if (!entry) {
    throw new Error("Scheduled workout not found.");
  }
  if (entry.sessionId) {
    throw new Error("This scheduled workout is already marked done.");
  }

  const { today, timezone } = await getUserContext(user.id);
  const completedAt =
    entry.scheduledDate === today
      ? new Date()
      : await toNoonInstant(entry.scheduledDate, timezone);

  const session = await createSessionForWorkout(
    user.id,
    entry.workoutId,
    { kind: "specific", scheduledWorkoutId: entry.id },
    completedAt
  );

  if (!session) {
    throw new Error("Workout not found.");
  }

  revalidatePath("/workouts");
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/stats");
  revalidatePath("/profile");
}

/**
 * Removes one of the authenticated user's scheduled workouts, bound with
 * the id via .bind(null, id) from UpcomingList and from WeekStrip's day
 * cards. Ownership is enforced by unscheduleForUser's WHERE clauses. If the
 * entry was Completed (session_id NOT NULL), its workout_session is deleted
 * along with it — see unscheduleForUser's doc comment — so this can affect
 * training history and stats, not just the two pages that render the
 * scheduled-workout lists.
 */
export async function unscheduleWorkout(id: string) {
  const user = await requireUser();

  await unscheduleForUser(id, user.id);

  revalidatePath("/");
  revalidatePath("/workouts");
  revalidatePath("/calendar");
  revalidatePath("/history");
  revalidatePath("/stats");
}
