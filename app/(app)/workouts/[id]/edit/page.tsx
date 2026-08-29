import { notFound } from "next/navigation";
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
import { getTagCatalog } from "@/lib/tags";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";
import WorkoutBuilder from "../../builder/WorkoutBuilder";

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

  const [workout, exerciseCatalog, tagCatalog] = await Promise.all([
    getWorkoutForUser(id, user.id),
    getExerciseCatalog(),
    getTagCatalog(),
  ]);

  if (!workout) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-xl font-semibold">Edit workout</h1>

        <WorkoutBuilder
          primaryTypeOptions={workoutPrimaryTypeEnum.enumValues}
          difficultyOptions={workoutDifficultyEnum.enumValues}
          blockTypeOptions={blockTypeEnum.enumValues}
          volumeTypeOptions={volumeTypeEnum.enumValues}
          targetTypeOptions={targetTypeEnum.enumValues}
          targetPresetOptions={targetPresetEnum.enumValues}
          exerciseCatalog={exerciseCatalog}
          tagCatalog={tagCatalog}
          initialWorkout={workout}
          workoutId={workout.id}
        />
      </div>
    </main>
  );
}
