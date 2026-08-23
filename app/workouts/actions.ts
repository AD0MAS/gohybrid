"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createWorkoutForUser } from "@/lib/workouts";
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
