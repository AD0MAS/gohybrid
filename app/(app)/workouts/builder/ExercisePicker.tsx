import type { Dispatch } from "react";
import type { BuilderAction, CatalogExercise } from "./reducer";

const CUSTOM_VALUE = "custom";

type ExerciseCategory = CatalogExercise["category"];

const CATEGORY_ORDER: readonly ExerciseCategory[] = ["exercise", "run", "rest"];

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  exercise: "Exercises",
  run: "Runs",
  rest: "Rest",
};

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
 * by exercises.category via <optgroup>, plus a "Custom…" option — styled
 * and structured like PersonalRecordFields' exercise/custom-name pair.
 * Choosing "Custom…" reveals a text input for the name; choosing a catalog
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

  const catalogByCategory = new Map<ExerciseCategory, CatalogExercise[]>();
  for (const exercise of catalog) {
    const group = catalogByCategory.get(exercise.category) ?? [];
    group.push(exercise);
    catalogByCategory.set(exercise.category, group);
  }

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
          <option value={CUSTOM_VALUE}>Custom…</option>
          {CATEGORY_ORDER.map((category) => {
            const categoryExercises = catalogByCategory.get(category);
            if (!categoryExercises || categoryExercises.length === 0) {
              return null;
            }

            return (
              <optgroup key={category} label={CATEGORY_LABELS[category]}>
                {categoryExercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                    {exercise.equipment ? ` (${exercise.equipment})` : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
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
