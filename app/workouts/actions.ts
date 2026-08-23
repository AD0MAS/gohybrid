"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { workouts } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { validateWorkoutInput } from "./validation";

/**
 * Creates a workout for the authenticated user from a /workouts/new form
 * submission, using the same validation rules as POST /api/workouts (see
 * validateWorkoutInput). On success, revalidates /workouts and redirects
 * there. On failure, redirects back to /workouts/new with the error
 * message attached as a query parameter so the page can display it.
 */
export async function createWorkout(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

  await db.insert(workouts).values({
    userId: user.id,
    title: result.data.title,
    description: result.data.description,
    primaryType: result.data.primaryType,
    difficulty: result.data.difficulty,
    estimatedDurationMinutes: result.data.estimatedDurationMinutes,
  });

  revalidatePath("/workouts");
  redirect("/workouts");
}
