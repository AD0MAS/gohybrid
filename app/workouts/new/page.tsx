import Link from "next/link";
import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { createWorkout } from "../actions";

export default async function NewWorkoutPage(
  props: PageProps<"/workouts/new">
) {
  const { error } = await props.searchParams;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">New workout</h1>

      {error && (
        <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={createWorkout} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            name="title"
            required
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            name="description"
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Primary type
          <select
            name="primaryType"
            required
            defaultValue=""
            className="rounded border border-gray-300 p-2"
          >
            <option value="" disabled>
              Select a type
            </option>
            {workoutPrimaryTypeEnum.enumValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Difficulty
          <select
            name="difficulty"
            required
            defaultValue=""
            className="rounded border border-gray-300 p-2"
          >
            <option value="" disabled>
              Select a difficulty
            </option>
            {workoutDifficultyEnum.enumValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Estimated duration (minutes)
          <input
            type="number"
            name="estimatedDurationMinutes"
            min={1}
            step={1}
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <button type="submit" className="rounded bg-black p-2 text-white">
          Create workout
        </button>
      </form>

      <Link href="/workouts" className="text-sm underline">
        Back to workouts
      </Link>
    </main>
  );
}
