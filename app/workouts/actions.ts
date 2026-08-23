"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  createWorkoutForUser,
  deleteWorkoutForUser,
  updateWorkoutForUser,
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
 * Updates one of the authenticated user's workouts from a
 * /workouts/[id]/edit form submission, using the same validation as
 * createWorkout. The page binds `id` via `updateWorkout.bind(null, id)`
 * since a form action otherwise only receives FormData. Ownership is
 * enforced by updateWorkoutForUser's WHERE clause, not by trusting that
 * the caller only reaches this action through the edit page — a forged
 * request naming another user's workout id updates nothing. On success,
 * revalidates /workouts and the workout's detail page, then redirects to
 * the detail page. On failure, redirects back to the edit page with the
 * error message attached as a query parameter.
 */
export async function updateWorkout(id: string, formData: FormData) {
  const user = await requireUser();

  const result = validateWorkoutInput({
    title: formData.get("title"),
    description: formData.get("description"),
    primaryType: formData.get("primaryType"),
    difficulty: formData.get("difficulty"),
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes"),
  });

  if (!result.success) {
    redirect(
      `/workouts/${id}/edit?error=${encodeURIComponent(result.error)}`
    );
  }

  const updated = await updateWorkoutForUser(id, user.id, result.data);

  if (!updated) {
    redirect(
      `/workouts/${id}/edit?error=${encodeURIComponent("Workout not found.")}`
    );
  }

  revalidatePath("/workouts");
  revalidatePath(`/workouts/${id}`);
  redirect(`/workouts/${id}`);
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
