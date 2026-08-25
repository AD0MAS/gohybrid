"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSessionForWorkout } from "@/lib/sessions";

/**
 * Finishes a workout for the authenticated user, creating its
 * workout_session. Unlike createWorkout/updateFullWorkout, this does not
 * redirect itself — StartWorkoutClient still needs to clear the workout's
 * localStorage progress (a client-only operation) before navigating away,
 * so it awaits this action and only then clears storage and redirects.
 * Throws if the workout isn't found or isn't owned by the current user, so
 * the caller can show an error instead of silently doing nothing.
 */
export async function finishWorkout(workoutId: string) {
  const user = await requireUser();

  const session = await createSessionForWorkout(user.id, workoutId);

  if (!session) {
    throw new Error("Workout not found.");
  }

  revalidatePath("/history");

  return session;
}
