import type { Dispatch } from "react";
import { groupExercisesForSelect } from "@/lib/exercise-groups";
import type { BuilderAction, CatalogExercise } from "./reducer";

const CUSTOM_VALUE = "custom";

type ExercisePickerProps = {
  blockId: string;
  itemId: string;
  exerciseId: string | null;
  customName: string | null;
  catalog: readonly CatalogExercise[];
  dispatch: Dispatch<BuilderAction>;
};

/**
 * Picks an item's exercise: either linked to a catalog entry
 * (`exerciseId` set) or a free-typed custom name (`customName` set —
 * "Quick add" from GOHYBRID_PLAN.md §5), never both; the reducer enforces
 * this on every write. A single <select> lists the full catalog, grouped
 * via <optgroup> by groupExercisesForSelect (lib/exercises.ts) — the same
 * HYROX/Exercises/Runs/Rest grouping PersonalRecordFields/GoalFields use —
 * plus a "Custom (new)…" option first. There's no "Previously used" group
 * here: that comes from a user's personal_records history, which the
 * builder has no reason to fetch. Choosing "Custom (new)…" reveals a text
 * input for the name; choosing a catalog
 * exercise hides it. Unlike PersonalRecordFields (where an exercise or a
 * custom name is always required), an item can also be genuinely
 * unselected — GOHYBRID_PLAN.md's save requirement is about
 * volume/weight/duration, not exercise selection — so the select carries
 * its own neutral "" option instead of overloading "" for Custom. Not a
 * "use client" file itself — see ItemEditor/WorkoutBuilder.
 */
export default function ExercisePicker({
  blockId,
  itemId,
  exerciseId,
  customName,
  catalog,
  dispatch,
}: ExercisePickerProps) {
  const selectValue = exerciseId ?? (customName !== null ? CUSTOM_VALUE : "");
  const groups = groupExercisesForSelect(catalog);

  function handleSelectChange(value: string) {
    if (value === CUSTOM_VALUE) {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId,
        field: "customName",
        value: "",
      });
      return;
    }

    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId,
      field: "exerciseId",
      value: value === "" ? null : value,
    });
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1">
        Exercise
        <select
          value={selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <option value="">Select exercise…</option>
          <option value={CUSTOM_VALUE}>Custom (new)…</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                  {exercise.equipment ? ` (${exercise.equipment})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {selectValue === CUSTOM_VALUE && (
        <input
          type="text"
          value={customName ?? ""}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_ITEM_FIELD",
              blockId,
              itemId,
              field: "customName",
              value: e.target.value,
            })
          }
          placeholder="Custom name"
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      )}
    </div>
  );
}
