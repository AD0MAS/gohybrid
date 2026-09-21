"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  getScheduledWorkoutForUser,
  markSkippedForUser,
  rescheduleForUser,
  unscheduleForUser,
} from "@/lib/scheduled-workouts";
import { validateScheduleInput } from "@/lib/scheduled-workouts-validation";
import { createSessionForWorkout } from "@/lib/sessions";
import { toNoonInstant } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";
import { echoFormValues } from "@/lib/form-state";
import { redirectBackWithSaved } from "@/lib/redirect-back";
import type { ScheduleFormState } from "./workouts/actions";

/**
 * Sets is_skipped on one of the authenticated user's scheduled workouts,
 * bound with the id (and the target value) via .bind(null, id, isSkipped)
 * from WeekStrip's day-card menu. Ownership is enforced by
 * markSkippedForUser's WHERE clause. Throws if nothing matched, so a forged
 * id can't silently no-op. Revalidates / (Home), which renders WeekStrip.
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

  revalidatePath("/");
}

/**
 * Updates the date, time and notes of one of the authenticated user's
 * scheduled workouts, bound with the id via .bind(null, id) from the
 * generalized ScheduleWorkoutForm's `entry`-present branch on WeekStrip's
 * day-card menu and Home's TODAY card. Reads the entry first
 * (getScheduledWorkoutForUser) rather
 * than going straight to rescheduleForUser, so a completed entry gets its
 * own clear error instead of the generic 404 a forged/foreign id would —
 * unlike unscheduleWorkout/markScheduledWorkoutSkipped, "not found" and
 * "found but not eligible" are genuinely different outcomes here, and only
 * one of them is a state the user themselves can be looking at (their own
 * WeekStrip only ever renders a Reschedule control for a Planned or Skipped
 * entry, but a stale page or a second tab could still race one to
 * Completed). Shares validateScheduleInput with scheduleWorkout — the past-
 * date rule and every other check apply identically to a reschedule — passing
 * the entry's own unchanged workoutId, since this action only ever moves an
 * existing plan, never repoints it at a different workout.
 */
export async function rescheduleWorkout(
  id: string,
  _prevState: ScheduleFormState,
  formData: FormData
): Promise<ScheduleFormState> {
  const user = await requireUser();

  const entry = await getScheduledWorkoutForUser(id, user.id);
  if (!entry) {
    throw new Error("Scheduled workout not found.");
  }
  if (entry.sessionId) {
    return {
      status: "error",
      error: "A completed entry can't be rescheduled.",
      values: echoFormValues(formData),
    };
  }

  const { today, now } = await getUserContext(user.id);

  const result = validateScheduleInput(
    {
      workoutId: entry.workoutId,
      scheduledDate: formData.get("scheduledDate"),
      scheduledTime: formData.get("scheduledTime"),
      notes: formData.get("notes"),
    },
    today,
    now
  );

  if (!result.success) {
    return {
      status: "error",
      error: result.error,
      values: echoFormValues(formData),
    };
  }

  const updated = await rescheduleForUser(
    id,
    user.id,
    result.data.scheduledDate,
    result.data.scheduledTime,
    result.data.notes
  );

  if (!updated) {
    return {
      status: "error",
      error: "This entry can no longer be rescheduled.",
      values: echoFormValues(formData),
    };
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  // Set by ScheduleWorkoutForm only when the date changed, which moves the
  // entry off the day (or off TODAY) its form is rendered in — see
  // redirectBackWithSaved for why the confirmation must come from the page.
  redirectBackWithSaved(formData.get("returnTo"), "rescheduled");
  return { status: "success" };
}

/**
 * Records that one of the authenticated user's scheduled workouts was
 * actually done — bound with the id via .bind(null, id) from the "Mark
 * done" control on WeekStrip's day-card menu and Home's TODAY card, for a
 * workout completed away from Start Workout Mode (the core loop's "After"
 * moment doesn't require having run "During" through this app). Reuses createSessionForWorkout, the same lib/ function
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
    { completedAt }
  );

  if (!session) {
    throw new Error("Workout not found.");
  }

  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/stats");
  revalidatePath("/profile");
}

/**
 * Removes one of the authenticated user's scheduled workouts, bound with
 * the id via .bind(null, id) from WeekStrip's day-card menu. Ownership is
 * enforced by unscheduleForUser's WHERE clauses. If the entry was Completed
 * (session_id NOT NULL), its workout_session is deleted along with it — see
 * unscheduleForUser's doc comment — so this can affect training history and
 * stats, not just Home.
 */
export async function unscheduleWorkout(id: string) {
  const user = await requireUser();

  await unscheduleForUser(id, user.id);

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/history");
  revalidatePath("/stats");
}
