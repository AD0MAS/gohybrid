"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSessionForWorkout } from "@/lib/sessions";
import { getUserContext } from "@/lib/user-settings";

/**
 * Finishes a workout for the authenticated user, creating its
 * workout_session. Unlike createWorkout/updateFullWorkout, this does not
 * redirect itself — StartWorkoutClient still needs to clear the workout's
 * localStorage progress (a client-only operation) before navigating away,
 * so it awaits this action and only then clears storage and redirects.
 * Throws if the workout isn't found or isn't owned by the current user, so
 * the caller can show an error instead of silently doing nothing.
 *
 * completedAt is left to createSessionForWorkout's DB-default `now()` — a
 * Finish always means "just now." The link target is today in the user's
 * own timezone (getUserContext), not Postgres's `current_date`, so linking
 * agrees with every other "what day is it" read in this codebase. When
 * nothing matches, createSessionForWorkout backfills a scheduled_workouts
 * row instead, so an unplanned Finish still shows up as Completed on the
 * week strip and calendar — hence revalidating those routes too, not just
 * /history.
 */
export async function finishWorkout(workoutId: string) {
  const user = await requireUser();
  const { today, timezone } = await getUserContext(user.id);

  const session = await createSessionForWorkout(user.id, workoutId, {
    kind: "sameDay",
    date: today,
    timezone,
  });

  if (!session) {
    throw new Error("Workout not found.");
  }

  revalidatePath("/history");
  revalidatePath("/");
  revalidatePath("/workouts");
  revalidatePath("/calendar");
  revalidatePath("/stats");

  return session;
}
