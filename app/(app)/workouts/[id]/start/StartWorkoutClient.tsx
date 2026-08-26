"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { unitSystemEnum } from "@/db/schema";
import type { getWorkoutForUser } from "@/lib/workouts";
import { formatDistanceMetres, formatWeightKg } from "@/lib/units";
import { finishWorkout } from "./actions";

type Workout = NonNullable<Awaited<ReturnType<typeof getWorkoutForUser>>>;
type Item = Workout["blocks"][number]["items"][number];
type UnitSystem = (typeof unitSystemEnum.enumValues)[number];

type StartWorkoutClientProps = {
  workout: Workout;
  unitSystem: UnitSystem;
};

/** Shape persisted to localStorage — see the component doc comment for why
 * `updatedAt` is stored alongside the checked ids. */
type StoredProgress = {
  updatedAt: string;
  checkedItemIds: string[];
};

function storageKey(workoutId: string) {
  return `gohybrid:start-workout:${workoutId}`;
}

/**
 * Builds the same "Sets: … · Volume: … · Target: … · Weight: … · Rest: …"
 * line the workout detail page shows, omitting whichever fields aren't set
 * on this item. Weight and a distance volume are converted for display via
 * lib/units.ts — pure, DB-free functions, so calling them here (rather
 * than pre-formatting server-side, as lib/progress.ts does for the
 * Progress Chart) is fine: `unitSystem` is already available as a prop,
 * and nothing here needs another query.
 */
function formatItemDetails(item: Item, unitSystem: UnitSystem): string[] {
  const isHyroxStation = item.exercise?.isHyroxStation ?? false;

  let volume: string | null = null;
  if (item.volumeType) {
    if (item.volumeValue == null) {
      volume = `${item.volumeType} (open ended)`;
    } else if (item.volumeType === "distance") {
      const d = formatDistanceMetres(
        Number(item.volumeValue),
        unitSystem,
        isHyroxStation
      );
      volume = `${d.value} ${d.unit}`;
    } else {
      volume = `${item.volumeValue} ${item.volumeType}`;
    }
  }

  const target =
    item.targetPreset ??
    (item.targetType
      ? item.targetValue != null
        ? `${item.targetValue} ${item.targetType}`
        : item.targetType
      : null);

  const weight =
    item.weightKg != null
      ? formatWeightKg(Number(item.weightKg), unitSystem)
      : null;

  return [
    `Sets: ${item.sets}`,
    volume && `Volume: ${volume}`,
    target && `Target: ${target}`,
    weight && `Weight: ${weight.value} ${weight.unit}`,
    item.restSeconds != null && `Rest: ${item.restSeconds}s`,
  ].filter((part): part is string => Boolean(part));
}

/**
 * Checkable block/item list for Start Workout Mode. Checkbox state is
 * UI-only — nothing here is written to workout_sessions, which deliberately
 * stores no performance data (see GOHYBRID_PLAN.md §7, "avoids fake
 * analytics") — but it survives a page reload via localStorage, since a
 * real workout runs 40-60 minutes and phones lock their screens in between.
 *
 * Progress is keyed by workout id and stamped with the workout's
 * `updated_at`. If the workout has since been edited, `updated_at` will
 * have moved on, so saved progress from before the edit is discarded on
 * load instead of being applied to what may now be a different set of
 * items. There is one checkbox per item — block `rounds` and item `sets`
 * are shown as information only, not multiplied into separate checkboxes.
 */
export default function StartWorkoutClient({
  workout,
  unitSystem,
}: StartWorkoutClientProps) {
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [isFinishing, startFinishing] = useTransition();
  const router = useRouter();
  const updatedAtIso = workout.updatedAt.toISOString();

  // localStorage isn't available during server rendering, so the saved
  // progress is read here, in an effect after mount, rather than during
  // render.
  useEffect(() => {
    let restored = new Set<string>();
    try {
      const raw = window.localStorage.getItem(storageKey(workout.id));
      if (raw) {
        const stored = JSON.parse(raw) as StoredProgress;
        if (stored.updatedAt === updatedAtIso) {
          restored = new Set(stored.checkedItemIds);
        }
      }
    } catch {
      // Corrupt or inaccessible storage — start from an empty checklist.
    }
    // localStorage is an external platform API that doesn't exist during
    // SSR, so this read can only happen post-mount; a lazy useState
    // initializer would run during the server render too and desync from
    // the client's hydration output.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckedItemIds(restored);
    setHydrated(true);
  }, [workout.id, updatedAtIso]);

  // Skipped until the read above has run once, so this doesn't fire first
  // and overwrite saved progress with an empty checklist.
  useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      const payload: StoredProgress = {
        updatedAt: updatedAtIso,
        checkedItemIds: Array.from(checkedItemIds),
      };
      window.localStorage.setItem(
        storageKey(workout.id),
        JSON.stringify(payload)
      );
    } catch {
      // Storage full or inaccessible — progress just won't survive a reload.
    }
  }, [hydrated, checkedItemIds, workout.id, updatedAtIso]);

  const totalItems = workout.blocks.reduce(
    (sum, block) => sum + block.items.length,
    0
  );

  function toggleItem(itemId: string) {
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  /**
   * Creates the workout_session, then clears this workout's saved
   * localStorage progress and redirects to Training History. The clear has
   * to happen client-side after the action resolves — rather than inside
   * finishWorkout itself, which could redirect server-side instead — since
   * localStorage doesn't exist on the server.
   */
  function finish() {
    setFinishError(null);
    startFinishing(async () => {
      try {
        await finishWorkout(workout.id);
        try {
          window.localStorage.removeItem(storageKey(workout.id));
        } catch {
          // Inaccessible storage — the session was still created; nothing
          // to clean up here.
        }
        router.push("/history");
      } catch {
        setFinishError(
          "Couldn't finish this workout. It may have been deleted."
        );
      }
    });
  }

  // Per the product decision, only interrupt with a confirmation when the
  // checklist is incomplete; finishing a fully-checked workout needs no
  // prompt.
  function handleFinishClick() {
    if (checkedItemIds.size < totalItems) {
      setShowConfirm(true);
    } else {
      finish();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium">
        {checkedItemIds.size} / {totalItems} done
      </p>

      {workout.blocks.length === 0 ? (
        <p className="text-sm text-gray-600">This workout has no blocks yet.</p>
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
                      const details = formatItemDetails(item, unitSystem);
                      const checked = checkedItemIds.has(item.id);

                      return (
                        <li
                          key={item.id}
                          className="border-t border-gray-200 pt-2"
                        >
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() => toggleItem(item.id)}
                            />
                            <span>
                              <p
                                className={`text-sm font-medium ${
                                  checked ? "text-gray-400 line-through" : ""
                                }`}
                              >
                                {name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {details.join(" · ")}
                              </p>
                              {item.notes && (
                                <p className="text-sm text-gray-600">
                                  Notes: {item.notes}
                                </p>
                              )}
                            </span>
                          </label>
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

      {finishError && <p className="text-sm text-red-700">{finishError}</p>}

      <button
        type="button"
        onClick={handleFinishClick}
        disabled={isFinishing}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isFinishing ? "Finishing…" : "Finish Workout"}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-w-sm flex-col gap-4 rounded bg-white p-4">
            <p className="text-sm">
              {checkedItemIds.size} / {totalItems} items are checked. Finish
              anyway?
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="text-sm underline"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  finish();
                }}
                className="rounded bg-black px-3 py-2 text-sm text-white"
              >
                Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
