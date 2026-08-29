"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { scheduleWorkoutForUser } from "@/lib/scheduled-workouts";
import { validateScheduleInput } from "@/lib/scheduled-workouts-validation";
import {
  createWorkoutForUser,
  deleteWorkoutForUser,
  toggleFavoriteForUser,
} from "@/lib/workouts";
import { validateWorkoutInput } from "@/lib/workouts-validation";

/**
 * Creates a workout for the authenticated user from a /workouts/new form
 * submission, using the same validation rules as POST /api/workouts (see
 * validateWorkoutInput). On success, revalidates /workouts/library and
 * redirects there. On failure, redirects back to /workouts/new with the
 * error message attached as a query parameter so the page can display it.
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

  revalidatePath("/workouts/library");
  redirect("/workouts/library");
}

/**
 * Deletes one of the authenticated user's workouts, bound with the
 * workout id via .bind(null, id) from the delete-confirmation modal.
 * Ownership is enforced by deleteWorkoutForUser's WHERE clause, not by
 * trusting that the caller only reaches this action through the detail
 * page — a forged request naming another user's workout id deletes
 * nothing. On success, revalidates /workouts/library and redirects there.
 */
export async function deleteWorkout(id: string) {
  const user = await requireUser();

  await deleteWorkoutForUser(id, user.id);

  revalidatePath("/workouts/library");
  redirect("/workouts/library");
}

/**
 * Flips is_favorite for one of the authenticated user's workouts, bound
 * with the workout id via .bind(null, id) on the page. Ownership is
 * enforced by toggleFavoriteForUser's WHERE clause. Throws if nothing
 * matched (the workout was deleted or isn't owned by the current user
 * between page load and this call), so FavoriteToggle's optimistic state
 * can catch the failure and revert. Revalidates /workouts/library and the
 * workout's detail page on success — no redirect, since this is used
 * inline on both pages.
 */
export async function toggleFavorite(id: string) {
  const user = await requireUser();

  const isFavorite = await toggleFavoriteForUser(id, user.id);

  if (isFavorite === null) {
    throw new Error("Workout not found.");
  }

  revalidatePath("/workouts/library");
  revalidatePath(`/workouts/${id}`);
}

/**
 * Schedules one of the authenticated user's workouts for a future date,
 * from the workout detail page's Schedule control — bound with the
 * workout id via .bind(null, workoutId). Uses the same
 * validateScheduleInput rules as POST /api/scheduled-workouts, so the two
 * never drift apart. Throws on invalid input or if the workout isn't
 * found/owned, so ScheduleWorkoutForm can catch and display the error —
 * same contract as toggleFavorite. Revalidates the workout detail page and
 * /workouts and / (Home) — the pages that render UpcomingList — on
 * success, no redirect, since this is used inline on the detail page.
 */
export type ScheduleFormState =
  | { status: "idle" }
  | { status: "error"; error: string }
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

  const result = validateScheduleInput({
    workoutId,
    scheduledDate: formData.get("scheduledDate"),
    scheduledTime: formData.get("scheduledTime"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return { status: "error", error: result.error };
  }

  const created = await scheduleWorkoutForUser(
    user.id,
    result.data.workoutId,
    result.data.scheduledDate,
    result.data.scheduledTime,
    result.data.notes
  );

  if (!created) {
    return { status: "error", error: "Workout not found." };
  }

  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/workouts");
  revalidatePath("/");
  return { status: "success" };
}
