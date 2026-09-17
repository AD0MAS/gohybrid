"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { scheduleWorkoutForUser } from "@/lib/scheduled-workouts";
import {
  validateLogPastSessionInput,
  validateScheduleInput,
} from "@/lib/scheduled-workouts-validation";
import { createSessionForWorkout } from "@/lib/sessions";
import { toInstantAtTime } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";
import { deleteWorkoutForUser, toggleFavoriteForUser } from "@/lib/workouts";
import { echoFormValues } from "@/lib/form-state";

/**
 * Deletes one of the authenticated user's workouts, bound with the
 * workout id via .bind(null, id) from the delete-confirmation modal.
 * Ownership is enforced by deleteWorkoutForUser's WHERE clause, not by
 * trusting that the caller only reaches this action through the detail
 * page — a forged request naming another user's workout id deletes
 * nothing. On success, revalidates /workouts and redirects there.
 */
export async function deleteWorkout(id: string) {
  const user = await requireUser();

  await deleteWorkoutForUser(id, user.id);

  revalidatePath("/workouts");
  redirect("/workouts");
}

/**
 * Flips is_favorite for one of the authenticated user's workouts, bound
 * with the workout id via .bind(null, id) on the page. Ownership is
 * enforced by toggleFavoriteForUser's WHERE clause. Throws if nothing
 * matched (the workout was deleted or isn't owned by the current user
 * between page load and this call), so FavoriteToggle's optimistic state
 * can catch the failure and revert. Revalidates /workouts and the
 * workout's detail page on success — no redirect, since this is used
 * inline on both pages.
 */
export async function toggleFavorite(id: string) {
  const user = await requireUser();

  const isFavorite = await toggleFavoriteForUser(id, user.id);

  if (isFavorite === null) {
    throw new Error("Workout not found.");
  }

  revalidatePath("/workouts");
  revalidatePath(`/workouts/${id}`);
}

/**
 * Schedules one of the authenticated user's workouts for a date that is
 * today or later — and, if it's today, a time that is now or later — from
 * the workout detail page's Schedule control, bound with the workout id via
 * .bind(null, workoutId). Uses the same validateScheduleInput rules as
 * POST /api/scheduled-workouts and rescheduleWorkout, so none of them can
 * drift apart — including both halves of the past rule, checked there
 * against `today`/`now`, resolved here via getUserContext. Returns
 * { status: "error", error } on invalid input or if the workout isn't
 * found/owned, rather than throwing, so ScheduleWorkoutForm can render it
 * inline instead of hitting app/error.tsx. Revalidates the workout detail
 * page and / (Home) — which renders both the week strip and the TODAY card
 * that can trigger this same action — on success, no redirect, since this
 * is used inline on the detail page.
 */
export type ScheduleFormState =
  | { status: "idle" }
  | { status: "error"; error: string; values: Record<string, string> }
  | { status: "success" };

/**
 * Schedules a workout for the authenticated user, bound with the workout id
 * via .bind(null, id) from the workout detail page. Passed to useActionState
 * in ScheduleWorkoutForm, so a validation failure is an expected outcome of
 * a form submission — it returns { status: "error", error } for the form to
 * render, rather than throwing (which would hit app/error.tsx). { status:
 * "success" } lets the schedule modal tell "nothing has happened yet" apart
 * from "saved", closing itself only once a save actually went through, same
 * pattern as the /profile *Fields components.
 */
export async function scheduleWorkout(
  workoutId: string,
  _prevState: ScheduleFormState,
  formData: FormData
): Promise<ScheduleFormState> {
  const user = await requireUser();
  const { today, now } = await getUserContext(user.id);

  const result = validateScheduleInput(
    {
      workoutId,
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

  const created = await scheduleWorkoutForUser(
    user.id,
    result.data.workoutId,
    result.data.scheduledDate,
    result.data.scheduledTime,
    result.data.notes
  );

  if (!created) {
    return {
      status: "error",
      error: "Workout not found.",
      values: echoFormValues(formData),
    };
  }

  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/");
  return { status: "success" };
}

export type LogPastSessionFormState =
  | { status: "idle" }
  | { status: "error"; error: string; values: Record<string, string> }
  | { status: "success" };

/**
 * Creates a completed workout_session for a chosen date at or before now, via
 * createSessionForWorkout — the same lib/ function finishWorkout and
 * markScheduledWorkoutDone go through, so a logged session has the identical
 * shape (snapshot columns, no status field) regardless of entry point.
 * `workoutId` travels inside FormData rather than as a bound argument,
 * unlike scheduleWorkout: the /workouts/[id] entry point (LogPastSessionForm's
 * `workoutId` prop) renders it as a hidden field, and once Home grows a
 * quick action for this — no workout known ahead of time — WorkoutPicker
 * will submit the same field from a <select> instead. One action, one
 * FormData shape, serves both without needing two exported functions or a
 * caller-supplied bind().
 *
 * The rule (validateLogPastSessionInput) is "not after now," not "before
 * today": a past date is accepted with or without a time; today is accepted
 * only with a time that is now or earlier, since a same-day completion with
 * no time, or one strictly after now, is what Mark done/Finish are for
 * instead — the current minute itself is valid either way, same as
 * validateScheduleInput's mirrored boundary on the other side of "now."
 * `today`/`now`/`timezone` all come from one getUserContext call, so the
 * date and time comparisons can't disagree about what instant "now" is.
 *
 * Uses createSessionForWorkout's "sameDay" link target, exactly like
 * finishWorkout: if the authenticated user already has an open (unlinked)
 * planned or skipped entry for this workout on this date, that entry is
 * completed in place rather than a second entry being created — only when
 * nothing matches does a new backfilled row appear. This is
 * createSessionForWorkout's own existing, correct behavior (see its doc
 * comment in lib/sessions.ts), not something specific to this action — named
 * here so a future reader doesn't mistake "logging twice for one plan
 * absorbs into it" for a bug. Concretely reachable now that today is
 * allowed: schedule a workout for today at 20:00, then log a past session
 * for the same workout today at 18:00 — the 18:00 log completes the 20:00
 * plan in place rather than leaving two entries for the one day.
 */
export async function logPastSession(
  _prevState: LogPastSessionFormState,
  formData: FormData
): Promise<LogPastSessionFormState> {
  const user = await requireUser();
  const { today, now, timezone } = await getUserContext(user.id);

  const result = validateLogPastSessionInput(
    {
      workoutId: formData.get("workoutId"),
      date: formData.get("date"),
      time: formData.get("time"),
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

  const completedAt = await toInstantAtTime(
    result.data.date,
    result.data.time,
    timezone
  );

  const session = await createSessionForWorkout(
    user.id,
    result.data.workoutId,
    { kind: "sameDay", date: result.data.date, timezone },
    completedAt
  );

  if (!session) {
    return {
      status: "error",
      error: "Workout not found.",
      values: echoFormValues(formData),
    };
  }

  revalidatePath(`/workouts/${result.data.workoutId}`);
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/stats");
  revalidatePath("/profile");
  return { status: "success" };
}
