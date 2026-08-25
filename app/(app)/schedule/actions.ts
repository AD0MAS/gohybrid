"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  markSkippedForUser,
  unscheduleForUser,
} from "@/lib/scheduled-workouts";

/**
 * Sets is_skipped on one of the authenticated user's scheduled workouts,
 * bound with the id (and the target value) via .bind(null, id, isSkipped)
 * from /schedule. Ownership is enforced by markSkippedForUser's WHERE
 * clause. Throws if nothing matched, so a forged id can't silently no-op.
 * Revalidates /schedule on success.
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

  revalidatePath("/schedule");
}

/**
 * Removes one of the authenticated user's scheduled workouts, bound with
 * the id via .bind(null, id) from /schedule. Ownership is enforced by
 * unscheduleForUser's WHERE clause. Any linked workout_session stays in
 * training history untouched. Revalidates /schedule on success.
 */
export async function unscheduleWorkout(id: string) {
  const user = await requireUser();

  await unscheduleForUser(id, user.id);

  revalidatePath("/schedule");
}
