import Link from "next/link";
import { notFound } from "next/navigation";
import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";
import { updateWorkout } from "../../actions";

/**
 * Edit form for one of the authenticated user's workouts, pre-filled with
 * its current values. Same fields as /workouts/new. 404s under the same
 * conditions as the detail page: missing id, malformed id, or a workout
 * owned by a different user.
 */
export default async function EditWorkoutPage(
  props: PageProps<"/workouts/[id]/edit">
) {
  const { id } = await props.params;
  const { error } = await props.searchParams;
  const user = await requireUser();

  if (!isValidUuid(id)) {
    notFound();
  }

  const workout = await getWorkoutForUser(id, user.id);

  if (!workout) {
    notFound();
  }

  const updateWorkoutWithId = updateWorkout.bind(null, workout.id);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Edit workout</h1>

      {error && (
        <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={updateWorkoutWithId} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            name="title"
            required
            defaultValue={workout.title}
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            name="description"
            defaultValue={workout.description ?? ""}
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Primary type
          <select
            name="primaryType"
            required
            defaultValue={workout.primaryType}
            className="rounded border border-gray-300 p-2"
          >
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
            defaultValue={workout.difficulty}
            className="rounded border border-gray-300 p-2"
          >
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
            defaultValue={workout.estimatedDurationMinutes ?? ""}
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <button type="submit" className="rounded bg-black p-2 text-white">
          Save changes
        </button>
      </form>

      <Link href={`/workouts/${workout.id}`} className="text-sm underline">
        Cancel
      </Link>
    </main>
  );
}
