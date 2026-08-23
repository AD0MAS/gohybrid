import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";

/**
 * Workout detail page: the workout's own fields, then each block (title,
 * block_type, and whichever timing fields are set) with its items
 * underneath. Queries the database directly via lib/workouts rather than
 * fetching /api/workouts/[id] — same reasoning as the /workouts list: a
 * Server Component runs in the same process as the database layer, so a
 * self-fetch would only add a network round trip and a duplicate auth
 * check.
 *
 * A missing id, a malformed id, and an id belonging to another user all
 * render the same not-found page, so this page never confirms whether a
 * given id exists.
 */
export default async function WorkoutDetailPage(
  props: PageProps<"/workouts/[id]">
) {
  const { id } = await props.params;
  const user = await requireUser();

  if (!isValidUuid(id)) {
    notFound();
  }

  const workout = await getWorkoutForUser(id, user.id);

  if (!workout) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/workouts" className="text-sm underline">
        Back to workouts
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{workout.title}</h1>
        {workout.description && (
          <p className="text-sm text-gray-600">{workout.description}</p>
        )}
        <p className="text-sm text-gray-600">
          {[
            workout.primaryType,
            workout.difficulty,
            workout.estimatedDurationMinutes != null &&
              `${workout.estimatedDurationMinutes} min`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {workout.blocks.length === 0 ? (
        <p className="text-sm text-gray-600">
          This workout has no blocks yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {workout.blocks.map((block) => {
            const timing = [
              block.durationSeconds != null &&
                `Duration: ${block.durationSeconds}s`,
              block.rounds != null && `Rounds: ${block.rounds}`,
              block.workSeconds != null && `Work: ${block.workSeconds}s`,
              block.restSeconds != null && `Rest: ${block.restSeconds}s`,
              block.intervalSeconds != null &&
                `Interval: ${block.intervalSeconds}s`,
            ].filter(Boolean);

            return (
              <li
                key={block.id}
                className="rounded border border-gray-300 p-3"
              >
                <p className="font-medium">
                  {block.title ? `${block.title} — ` : ""}
                  {block.blockType}
                </p>
                {timing.length > 0 && (
                  <p className="text-sm text-gray-600">{timing.join(" · ")}</p>
                )}

                {block.items.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-600">No items yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {block.items.map((item) => {
                      const name =
                        item.exercise?.name ??
                        item.customName ??
                        "Unnamed exercise";

                      const volume =
                        item.volumeType &&
                        (item.volumeValue != null
                          ? `${item.volumeValue} ${item.volumeType}`
                          : `${item.volumeType} (open ended)`);

                      const target =
                        item.targetPreset ??
                        (item.targetType
                          ? item.targetValue != null
                            ? `${item.targetValue} ${item.targetType}`
                            : item.targetType
                          : null);

                      const details = [
                        `Sets: ${item.sets}`,
                        volume && `Volume: ${volume}`,
                        target && `Target: ${target}`,
                        item.weightKg != null && `Weight: ${item.weightKg} kg`,
                        item.restSeconds != null &&
                          `Rest: ${item.restSeconds}s`,
                      ].filter(Boolean);

                      return (
                        <li
                          key={item.id}
                          className="border-t border-gray-200 pt-2"
                        >
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-sm text-gray-600">
                            {details.join(" · ")}
                          </p>
                          {item.notes && (
                            <p className="text-sm text-gray-600">
                              Notes: {item.notes}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
