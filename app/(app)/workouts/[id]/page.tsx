import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  formatDistanceMetres,
  formatDurationSeconds,
  formatWeightKg,
  secondsPerKmToSecondsPerMile,
} from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";
import { deleteWorkout, scheduleWorkout, toggleFavorite } from "../actions";
import { BLOCK_TYPE_LABELS } from "../builder/block-type-labels";
import { TARGET_PRESET_LABELS } from "../builder/target-preset-labels";
import { TARGET_TYPE_LABELS } from "../builder/target-type-labels";
import { VOLUME_TYPE_LABELS } from "../builder/volume-type-labels";
import { DIFFICULTY_LABELS } from "../difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "../primary-type-labels";
import { TAG_COLOR_CLASSES } from "../tag-colors";
import DeleteWorkoutModal from "./DeleteWorkoutModal";
import FavoriteToggle from "../FavoriteToggle";
import ScheduleWorkoutForm from "./ScheduleWorkoutForm";

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

  const [workout, { unitSystem }] = await Promise.all([
    getWorkoutForUser(id, user.id),
    getUserContext(user.id),
  ]);

  if (!workout) {
    notFound();
  }

  const deleteWorkoutWithId = deleteWorkout.bind(null, workout.id);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-xl font-semibold text-ink">
            {workout.title}
          </h1>
          <FavoriteToggle
            isFavorite={workout.isFavorite}
            toggleFavoriteAction={toggleFavorite.bind(null, workout.id)}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/workouts/${workout.id}/edit`}
            className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Edit
          </Link>
          <DeleteWorkoutModal deleteAction={deleteWorkoutWithId} />
        </div>
      </div>

      <div>
        {workout.description && (
          <p className="text-sm text-ink-subtle">{workout.description}</p>
        )}
        <p className="text-sm text-ink-subtle">
          {[
            PRIMARY_TYPE_LABELS[workout.primaryType].label,
            DIFFICULTY_LABELS[workout.difficulty].label,
            workout.estimatedDurationMinutes != null &&
              `${workout.estimatedDurationMinutes} min`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {workout.workoutTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {workout.workoutTags.map(({ tag }) => (
              <span
                key={tag.id}
                className={`rounded-full border px-3 py-1 text-xs ${TAG_COLOR_CLASSES[tag.color]}`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/workouts/${workout.id}/start`}
          className="flex h-12 items-center justify-center rounded-md bg-accent px-6 text-base font-medium text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Start Workout
        </Link>
        <ScheduleWorkoutForm
          scheduleAction={scheduleWorkout.bind(null, workout.id)}
        />
      </div>

      {workout.blocks.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          This workout has no blocks yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {workout.blocks.map((block) => {
            const timing = [
              block.durationSeconds != null &&
                `Duration: ${formatDurationSeconds(block.durationSeconds)}`,
              block.rounds != null && `Rounds: ${block.rounds}`,
              block.workSeconds != null &&
                `Work: ${formatDurationSeconds(block.workSeconds)}`,
              block.restSeconds != null &&
                `Rest: ${formatDurationSeconds(block.restSeconds)}`,
              block.intervalSeconds != null &&
                `Interval: ${formatDurationSeconds(block.intervalSeconds)}`,
            ].filter(Boolean);

            return (
              <li
                key={block.id}
                className="rounded-lg border border-hairline bg-surface-1 p-5"
              >
                <p className="font-medium text-ink">
                  {block.title ? `${block.title} — ` : ""}
                  {BLOCK_TYPE_LABELS[block.blockType].label}
                </p>
                {timing.length > 0 && (
                  <p className="text-sm text-ink-subtle">{timing.join(" · ")}</p>
                )}

                {block.items.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-subtle">No items yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {block.items.map((item) => {
                      const name =
                        item.exercise?.name ??
                        item.customName ??
                        "Unnamed exercise";

                      const isHyroxStation =
                        item.exercise?.isHyroxStation ?? false;

                      let volume: string | null = null;
                      if (item.volumeType) {
                        if (item.volumeValue == null) {
                          volume = `${VOLUME_TYPE_LABELS[item.volumeType].label} (open ended)`;
                        } else if (item.volumeType === "distance") {
                          const d = formatDistanceMetres(
                            Number(item.volumeValue),
                            unitSystem,
                            isHyroxStation
                          );
                          volume = `${d.value} ${d.unit}`;
                        } else if (item.volumeType === "duration") {
                          volume = formatDurationSeconds(
                            Number(item.volumeValue)
                          );
                        } else {
                          volume = `${item.volumeValue} ${VOLUME_TYPE_LABELS[item.volumeType].label}`;
                        }
                      }

                      const target = item.targetPreset
                        ? TARGET_PRESET_LABELS[item.targetPreset].label
                        : item.targetType === "pace_500m" ||
                            item.targetType === "pace_km"
                          ? item.targetValue == null
                            ? TARGET_TYPE_LABELS[item.targetType].label
                            : (() => {
                                // Mirrors formatItemSummary in
                                // ItemEditor.tsx: pace_500m always reads
                                // /500m; pace_km reads /km for a metric
                                // user, /mi (converted) for an imperial one.
                                const useMiles =
                                  item.targetType === "pace_km" &&
                                  unitSystem === "imperial";
                                const seconds = useMiles
                                  ? secondsPerKmToSecondsPerMile(
                                      Number(item.targetValue)
                                    )
                                  : Number(item.targetValue);
                                const unitLabel =
                                  item.targetType === "pace_500m"
                                    ? "/500m"
                                    : useMiles
                                      ? "/mi"
                                      : "/km";
                                return `${formatDurationSeconds(seconds)} ${unitLabel}`;
                              })()
                          : item.targetType
                            ? item.targetValue != null
                              ? `${item.targetValue} ${TARGET_TYPE_LABELS[item.targetType].label}`
                              : TARGET_TYPE_LABELS[item.targetType].label
                            : null;

                      const weight =
                        item.weightKg != null
                          ? formatWeightKg(Number(item.weightKg), unitSystem)
                          : null;

                      const details = [
                        `Sets: ${item.sets}`,
                        volume && `Volume: ${volume}`,
                        target && `Target: ${target}`,
                        weight && `Weight: ${weight.value} ${weight.unit}`,
                        item.restSeconds != null &&
                          `Rest: ${formatDurationSeconds(item.restSeconds)}`,
                      ].filter(Boolean);

                      return (
                        <li
                          key={item.id}
                          className="border-t border-hairline pt-2"
                        >
                          <p className="text-sm font-medium text-ink">{name}</p>
                          <p className="text-sm text-ink-subtle">
                            {details.join(" · ")}
                          </p>
                          {item.notes && (
                            <p className="text-sm text-ink-subtle">
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
      </div>
    </main>
  );
}
