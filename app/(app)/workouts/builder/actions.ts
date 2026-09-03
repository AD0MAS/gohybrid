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
import { getExerciseCatalog } from "@/lib/exercises";
import {
  createFullWorkoutForUser,
  updateFullWorkoutForUser,
} from "@/lib/workouts";
import {
  validateBuilderPayload,
  type BuilderEnumOptions,
  type RawBuilderPayload,
} from "@/lib/workout-builder-validation";

const STATIC_ENUM_OPTIONS = {
  primaryTypeOptions: workoutPrimaryTypeEnum.enumValues,
  difficultyOptions: workoutDifficultyEnum.enumValues,
  blockTypeOptions: blockTypeEnum.enumValues,
  volumeTypeOptions: volumeTypeEnum.enumValues,
  targetTypeOptions: targetTypeEnum.enumValues,
  targetPresetOptions: targetPresetEnum.enumValues,
};

/** Fetches the current exercise catalog and derives the one dynamic member
 * of BuilderEnumOptions from it — restExerciseIds, needed to tell a rest
 * item apart from a regular one (see that field's own doc comment). Kept
 * as a fresh query per call rather than cached at module scope: the
 * catalog is small (~43 rows, same reasoning as getExerciseCatalog's own
 * doc comment) and this is a low-traffic write path, not worth the
 * staleness risk of a module-level cache outliving a catalog edit. */
async function buildEnumOptions(): Promise<BuilderEnumOptions> {
  const exerciseCatalog = await getExerciseCatalog();
  return {
    ...STATIC_ENUM_OPTIONS,
    restExerciseIds: exerciseCatalog
      .filter((exercise) => exercise.category === "rest")
      .map((exercise) => exercise.id),
  };
}

/**
 * Persists a full workout built in the client-side builder — the
 * workout, its blocks, and each block's items — for the authenticated
 * user. Re-validates the payload with the same validateBuilderPayload
 * the builder already used for immediate feedback, since client-side
 * validation is only a UX convenience, not the real gate. Returns an
 * error object on failure so the Save button can display it — never
 * swallowed. On success, revalidates /workouts/library and redirects to
 * the new workout's detail page.
 */
export async function createFullWorkout(payload: RawBuilderPayload) {
  const user = await requireUser();

  const result = validateBuilderPayload(payload, await buildEnumOptions());
  if (!result.success) {
    return { error: result.error };
  }

  const workout = await createFullWorkoutForUser(user.id, result.data);

  revalidatePath("/workouts/library");
  redirect(`/workouts/${workout.id}`);
}

/**
 * Persists edits made in the builder to an existing workout — replacing
 * its blocks and items entirely (see updateFullWorkoutForUser) — for the
 * authenticated user. Re-validates the payload with the same
 * validateBuilderPayload used for immediate feedback and by
 * createFullWorkout. Returns an error object on failure (including
 * "not found", which covers both a missing workout and one owned by
 * another user) so the Save button can display it. On success,
 * revalidates /workouts/library and the workout's detail page, then
 * redirects to the detail page.
 */
export async function updateFullWorkout(id: string, payload: RawBuilderPayload) {
  const user = await requireUser();

  const result = validateBuilderPayload(payload, await buildEnumOptions());
  if (!result.success) {
    return { error: result.error };
  }

  const workout = await updateFullWorkoutForUser(id, user.id, result.data);

  if (!workout) {
    return { error: "Workout not found." };
  }

  revalidatePath("/workouts/library");
  revalidatePath(`/workouts/${id}`);
  redirect(`/workouts/${id}`);
}
