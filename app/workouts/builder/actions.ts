"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  blockTypeEnum,
  targetPresetEnum,
  targetTypeEnum,
  volumeTypeEnum,
  workoutDifficultyEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { createFullWorkoutForUser } from "@/lib/workouts";
import {
  validateBuilderPayload,
  type RawBuilderPayload,
} from "@/lib/workout-builder-validation";

const ENUM_OPTIONS = {
  primaryTypeOptions: workoutPrimaryTypeEnum.enumValues,
  difficultyOptions: workoutDifficultyEnum.enumValues,
  blockTypeOptions: blockTypeEnum.enumValues,
  volumeTypeOptions: volumeTypeEnum.enumValues,
  targetTypeOptions: targetTypeEnum.enumValues,
  targetPresetOptions: targetPresetEnum.enumValues,
};

/**
 * Persists a full workout built in the client-side builder — the
 * workout, its blocks, and each block's items — for the authenticated
 * user. Re-validates the payload with the same validateBuilderPayload
 * the builder already used for immediate feedback, since client-side
 * validation is only a UX convenience, not the real gate. Returns an
 * error object on failure so the Save button can display it — never
 * swallowed. On success, revalidates /workouts and redirects to the new
 * workout's detail page.
 */
export async function createFullWorkout(payload: RawBuilderPayload) {
  const user = await requireUser();

  const result = validateBuilderPayload(payload, ENUM_OPTIONS);
  if (!result.success) {
    return { error: result.error };
  }

  const workout = await createFullWorkoutForUser(user.id, result.data);

  revalidatePath("/workouts");
  redirect(`/workouts/${workout.id}`);
}
