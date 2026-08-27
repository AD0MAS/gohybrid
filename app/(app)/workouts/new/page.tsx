import Link from "next/link";
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
import WorkoutBuilder from "../builder/WorkoutBuilder";

/**
 * Workout builder entry point — the only way to create a workout (see
 * GOHYBRID_PLAN.md §3). Enum values, the exercise catalog, and the tag
 * catalog are read here, server-side, and passed down as plain data so
 * the client builder never needs to import db/schema.ts or query the
 * database itself. All editing happens in the builder's client state;
 * Save doesn't persist anything yet.
 */
export default async function NewWorkoutPage() {
  await requireUser();
  const [exerciseCatalog, tagCatalog] = await Promise.all([
    getExerciseCatalog(),
    getTagCatalog(),
  ]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <Link href="/workouts/library" className="text-sm underline">
          Back to workouts
        </Link>

        <h1 className="text-xl font-semibold">New workout</h1>

        <WorkoutBuilder
          primaryTypeOptions={workoutPrimaryTypeEnum.enumValues}
          difficultyOptions={workoutDifficultyEnum.enumValues}
          blockTypeOptions={blockTypeEnum.enumValues}
          volumeTypeOptions={volumeTypeEnum.enumValues}
          targetTypeOptions={targetTypeEnum.enumValues}
          targetPresetOptions={targetPresetEnum.enumValues}
          exerciseCatalog={exerciseCatalog}
          tagCatalog={tagCatalog}
        />
      </div>
    </main>
  );
}
