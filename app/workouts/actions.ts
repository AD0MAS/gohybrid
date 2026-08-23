"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  createWorkoutForUser,
  deleteWorkoutForUser,
  toggleFavoriteForUser,
} from "@/lib/workouts";
import { validateWorkoutInput } from "@/lib/workouts-validation";

/**
 * Creates a workout for the authenticated user from a /workouts/new form
 * submission, using the same validation rules as POST /api/workouts (see
 * validateWorkoutInput). On success, revalidates /workouts and redirects
 * there. On failure, redirects back to /workouts/new with the error
 * message attached as a query parameter so the page can display it.
 */
export async function createWorkout(formData: FormData) {
  const user = await requireUser();

  const result = validateWorkoutInput({
    title: formData.get("title"),
    description: formData.get("description"),
    primaryType: formData.get("primaryType"),
    difficulty: formData.get("difficulty"),
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes"),
  });

  if (!result.success) {
    redirect(`/workouts/new?error=${encodeURIComponent(result.error)}`);
  }

  await createWorkoutForUser(user.id, result.data);

  revalidatePath("/workouts");
  redirect("/workouts");
}

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
