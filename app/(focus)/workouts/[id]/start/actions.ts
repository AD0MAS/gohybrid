"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSessionForWorkout } from "@/lib/sessions";
import { validateSessionDuration } from "@/lib/sessions-validation";
import { getUserContext } from "@/lib/user-settings";

/**
 * Finishes a workout for the authenticated user, creating its
 * workout_session. Unlike createFullWorkout/updateFullWorkout, this does not
 * redirect itself — StartWorkoutClient still needs to clear the workout's
 * localStorage state (a client-only operation) before navigating away, so it
 * awaits this action and only then clears storage and redirects. Throws if
 * the workout isn't found or isn't owned by the current user, so the caller
 * can show an error instead of silently doing nothing.
 *
 * `durationSeconds` is the active time the client measured (pauses
 * excluded); null is still accepted for callers that time nothing. It is
 * derived, never typed, so an invalid value can only be a tampered request
 * and throws.
 *
 * completedAt is left to createSessionForWorkout's DB-default `now()` — a
 * Finish always means "just now." The link target is today in the user's
 * own timezone (getUserContext), not Postgres's `current_date`, so linking
 * agrees with every other "what day is it" read in this codebase. When
 * nothing matches, createSessionForWorkout backfills a scheduled_workouts
 * row instead, so an unplanned Finish still shows up as Completed on the
 * week strip and month calendar — hence revalidating Home too, not just
 * /history. The workout's own page lists its sessions with their duration, so
 * it is revalidated as well.
 */
export async function finishWorkout(
  workoutId: string,
  durationSeconds: number | null
) {
  const user = await requireUser();

  const duration = validateSessionDuration(durationSeconds);
  if (!duration.success) {
    throw new Error(duration.error);
  }

  const { today, timezone } = await getUserContext(user.id);

  const session = await createSessionForWorkout(
    user.id,
    workoutId,
    {
      kind: "sameDay",
      date: today,
      timezone,
    },
    { durationSeconds: duration.data }
  );

  if (!session) {
    throw new Error("Workout not found.");
  }

  revalidatePath("/history");
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/workouts/${workoutId}`);

  return session;
}
