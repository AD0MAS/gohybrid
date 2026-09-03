import { groupExercisesForSelect } from "@/lib/exercise-groups";
import type { CatalogExercise } from "./reducer";

const CUSTOM_VALUE = "custom";

type ExercisePickerProps = {
  exerciseId: string | null;
  customName: string | null;
  catalog: readonly CatalogExercise[];
  /** Selecting a catalog exercise or clearing back to "Select exercise…" —
   * mirrors the reducer's own exerciseId case, which always clears
   * customName alongside it (see ItemEditor's updateExerciseId). */
  onChangeExerciseId: (value: string | null) => void;
  /** Typing (or entering) a custom name — mirrors the reducer's own
   * customName case, which always clears exerciseId alongside it (see
   * ItemEditor's updateCustomName). */
  onChangeCustomName: (value: string) => void;
  /** The exerciseId/customName pair's own validation error, if any —
   * rendered beneath both fields since the rule ("needs either an
   * exercise or a custom name", "cannot have both") is about the pair, not
   * either field alone. */
  error?: string;
};

/**
 * Picks an item's exercise: either linked to a catalog entry
 * (`exerciseId` set) or a free-typed custom name (`customName` set —
 * "Quick add" from GOHYBRID_PLAN.md §5), never both — enforced here by
 * always clearing the other field on change, the same mutual exclusivity
 * the reducer's own UPDATE_ITEM_FIELD cases enforce for the committed
 * state (this component now writes to ItemEditor's draft instead, via
 * onChangeExerciseId/onChangeCustomName, so it must keep that guarantee
 * itself). A single <select> lists the full catalog, grouped via
 * <optgroup> by groupExercisesForSelect (lib/exercise-groups.ts) — Runs,
 * Rest, HYROX, Exercises, the same order and Rest inclusion
 * PersonalRecordFields/GoalFields also want minus their own
 * `includeRest: false` (a rest exercise can't have a personal record or
 * be a goal's target) — plus a "Custom (new)…" option first. There's no
 * "Previously used" group
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
  exerciseId,
  customName,
  catalog,
  onChangeExerciseId,
  onChangeCustomName,
  error,
}: ExercisePickerProps) {
  const selectValue = exerciseId ?? (customName !== null ? CUSTOM_VALUE : "");
  const groups = groupExercisesForSelect(catalog);

  function handleSelectChange(value: string) {
    if (value === CUSTOM_VALUE) {
      onChangeCustomName("");
      return;
    }

    onChangeExerciseId(value === "" ? null : value);
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
          onChange={(e) => onChangeCustomName(e.target.value)}
          placeholder="Custom name"
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
