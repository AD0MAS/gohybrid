import { useState, type Dispatch } from "react";
import type { BuilderAction, CatalogExercise } from "./reducer";

const EXERCISE_LIST_LIMIT = 20;

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
 * "Quick add" from GOHYBRID_PLAN.md §5), never both. With an empty query
 * the full ~43-row catalog is browsable; a non-empty query filters it by
 * name. The custom-name option is always offered alongside whatever's
 * visible, since a partial name match (e.g. "Run 5k intervals" matching
 * "Run") doesn't mean the user wants that catalog entry. The visible list
 * is capped, and the search text itself is local UI state here, not part
 * of the builder's reducer state. Not a "use client" file itself — see
 * ItemEditor/WorkoutBuilder.
 */
export default function ExercisePicker({
  blockId,
  itemId,
  exerciseId,
  customName,
  catalog,
  dispatch,
}: ExercisePickerProps) {
  const [query, setQuery] = useState("");

  const selectedExercise =
    exerciseId != null
      ? catalog.find((exercise) => exercise.id === exerciseId)
      : undefined;

  function selectExercise(id: string) {
    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId,
      field: "exerciseId",
      value: id,
    });
    setQuery("");
  }

  function selectCustomName(name: string) {
    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId,
      field: "customName",
      value: name,
    });
    setQuery("");
  }

  function clearSelection() {
    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId,
      field: "exerciseId",
      value: null,
    });
    setQuery("");
  }

  if (selectedExercise) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink">
        <span>
          {selectedExercise.name}
          {selectedExercise.equipment ? ` (${selectedExercise.equipment})` : ""}
        </span>
        <button
          type="button"
          onClick={clearSelection}
          className="text-ink-subtle underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Change
        </button>
      </div>
    );
  }

  if (customName) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink">
        <span>{customName} (custom)</span>
        <button
          type="button"
          onClick={clearSelection}
          className="text-ink-subtle underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Change
        </button>
      </div>
    );
  }

  const trimmedQuery = query.trim();
  // Empty query browses the full catalog (GOHYBRID_PLAN.md §5); a
  // non-empty query filters it by name. Either way the visible list is
  // capped so a long catalog can't overwhelm the item editor.
  const filtered =
    trimmedQuery === ""
      ? catalog
      : catalog.filter((exercise) =>
          exercise.name.toLowerCase().includes(trimmedQuery.toLowerCase())
        );
  const visibleExercises = filtered.slice(0, EXERCISE_LIST_LIMIT);
  const hiddenCount = filtered.length - visibleExercises.length;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1">
        Exercise
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the catalog…"
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </label>

      {visibleExercises.length > 0 && (
        <ul className="flex flex-col gap-1">
          {visibleExercises.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => selectExercise(exercise.id)}
                className="text-ink underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              >
                {exercise.name}
                {exercise.equipment ? ` (${exercise.equipment})` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <p className="text-xs text-ink-subtle">
          Showing {visibleExercises.length} of {filtered.length}
          {trimmedQuery === "" ? " — keep typing to narrow the list." : "."}
        </p>
      )}

      {trimmedQuery !== "" && (
        <div className="border-t border-hairline pt-2">
          <button
            type="button"
            onClick={() => selectCustomName(trimmedQuery)}
            className="self-start text-ink underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Use &quot;{trimmedQuery}&quot; as a custom name
          </button>
        </div>
      )}
    </div>
  );
}
