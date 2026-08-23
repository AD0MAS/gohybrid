import Link from "next/link";
import { blockTypeEnum, workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import WorkoutBuilder from "../builder/WorkoutBuilder";

/**
 * Workout builder entry point — the only way to create a workout (see
 * GOHYBRID_PLAN.md §3). Enum values are read here, server-side, and
 * passed down as plain string arrays so the client builder never needs
 * to import db/schema.ts itself. All editing happens in the builder's
 * client state; Save doesn't persist anything yet.
 */
export default async function NewWorkoutPage() {
  await requireUser();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/workouts" className="text-sm underline">
        Back to workouts
      </Link>

      <h1 className="text-xl font-semibold">New workout</h1>

      <WorkoutBuilder
        primaryTypeOptions={workoutPrimaryTypeEnum.enumValues}
        difficultyOptions={workoutDifficultyEnum.enumValues}
        blockTypeOptions={blockTypeEnum.enumValues}
      />
    </main>
  );
}
