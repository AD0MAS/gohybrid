import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOCK_TYPES, TARGET_PRESETS, TARGET_TYPES, VOLUME_TYPES, WORKOUT_DIFFICULTIES, WORKOUT_PRIMARY_TYPES } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { getTagCatalog } from "@/lib/tags";
import { getUserContext } from "@/lib/user-settings";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/uuid";
import { PAGE_MAIN_CLASSES } from "../../../_components/shared-classes";
import WorkoutBuilder from "../../builder/WorkoutBuilder";

export const metadata: Metadata = {
  title: "Edit Workout",
};

/**
 * Edit entry point for one of the authenticated user's workouts — the
 * builder, pre-loaded with the workout's current meta, blocks, and items
 * (see WorkoutBuilder's `initialWorkout`/`workoutId` props and the
 * LOAD_WORKOUT reducer action). Mirrors /workouts/new: the builder is the
 * only way to edit a workout, replacing the previous metadata-only form.
 * 404s under the same conditions as the detail page: missing id,
 * malformed id, or a workout owned by a different user.
 */
export default async function EditWorkoutPage(
  props: PageProps<"/workouts/[id]/edit">
) {
  const { id } = await props.params;
  const user = await requireUser();

  if (!isValidUuid(id)) {
    notFound();
  }

  const [workout, exerciseCatalog, tagCatalog, { unitSystem }] = await Promise.all([
    getWorkoutForUser(id, user.id),
    getExerciseCatalog(),
    getTagCatalog(),
    getUserContext(user.id),
  ]);

  if (!workout) {
    notFound();
  }

  return (
    <main className={PAGE_MAIN_CLASSES}>
      <WorkoutBuilder
        heading="Edit workout"
        backHref={`/workouts/${workout.id}`}
        backLabel={workout.title}
        discardHref={`/workouts/${workout.id}`}
        primaryTypeOptions={WORKOUT_PRIMARY_TYPES}
        difficultyOptions={WORKOUT_DIFFICULTIES}
        blockTypeOptions={BLOCK_TYPES}
        volumeTypeOptions={VOLUME_TYPES}
        targetTypeOptions={TARGET_TYPES}
        targetPresetOptions={TARGET_PRESETS}
        exerciseCatalog={exerciseCatalog}
        tagCatalog={tagCatalog}
        unitSystem={unitSystem}
        initialWorkout={workout}
        workoutId={workout.id}
      />
    </main>
  );
}
