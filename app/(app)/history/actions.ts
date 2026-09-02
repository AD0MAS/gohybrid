"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteSessionForUser } from "@/lib/sessions";

/**
 * Deletes one of the authenticated user's workout sessions, bound with the
 * id via .bind(null, id) from /history. Ownership is enforced by
 * deleteSessionForUser's WHERE clause. Throws if nothing matched, so a
 * forged id can't silently no-op.
 *
 * Deleting a session changes streaks, session counts and goal progress —
 * everywhere those are read from workout_sessions — so every affected
 * route is revalidated: /history itself, / (Home's summary cards and
 * recent activity), /stats (all charts), /workouts (the week strip and
 * Upcoming, since a completed scheduled workout reverts to Planned via
 * scheduled_workouts.session_id's ON DELETE SET NULL, or — if it was
 * backfilled by finishWorkout — is deleted along with the session, see
 * deleteSessionForUser), /calendar (the same backfilled/reverted entry),
 * and /profile (goals that count sessions).
 */
export async function deleteSession(id: string) {
  const user = await requireUser();

  const deleted = await deleteSessionForUser(id, user.id);

  if (!deleted) {
    throw new Error("Session not found.");
  }

  revalidatePath("/history");
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/workouts");
  revalidatePath("/calendar");
  revalidatePath("/profile");
}
