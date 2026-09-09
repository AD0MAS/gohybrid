// No runtime imports of db/index.ts (or anything that reaches it) on
// purpose — PersonalRecordFields, GoalFields and ExercisePicker are client
// components, and importing a value from lib/exercises.ts (which imports
// `db`, and through it the `postgres` driver — Node-only, needs `fs`) would
// pull Drizzle into the browser bundle. The `import type` from db/schema.ts
// below is erased at compile time, so it doesn't count — same reasoning as
// lib/numeric-limits.ts's own zero-imports rule, just scoped to "no runtime
// import that reaches db" rather than "no imports at all."

import type { exercises } from "@/db/schema";

/** The subset of an exercises row every exercise <select> in the app groups
 * by — PersonalRecordFields/GoalFields narrow getExerciseCatalog's full rows
 * to this shape locally; the workout builder's own CatalogExercise (reducer.ts)
 * is the full row and satisfies this shape structurally. */
export type GroupableExercise = {
  id: string;
  name: string;
  category: (typeof exercises.$inferSelect)["category"];
  isHyroxStation: boolean;
};

export type ExerciseSelectGroup<T extends GroupableExercise> = {
  label: string;
  exercises: T[];
};

/**
 * Groups a catalog into the four category-driven <optgroup> sections every
 * exercise <select> in the app shares — Runs, Rest, HYROX, Exercises, in
 * that order — omitting any group with no members. HYROX stations are
 * pulled out of "exercise" into their own group ahead of it, since
 * is_hyrox_station already drives special handling elsewhere (distance
 * display — see lib/units.ts) and mixing them into a 40-row "Exercises"
 * group would bury them. The "Custom (new)…" sentinel and, where it
 * applies, a "Previously used" custom-names group are NOT this function's
 * concern — each caller renders those itself, since the builder has no
 * customNames and encodes its <select> value differently than
 * PersonalRecordFields/GoalFields (see ExercisePicker's own doc comment).
 *
 * This order (and the shape of `options` below) used to live only in
 * ExercisePicker, reordering this function's own HYROX/Exercises/Runs/Rest
 * default locally, because PersonalRecordFields/GoalFields rendered this
 * function's groups unmodified and the two use cases genuinely diverged.
 * They no longer do: a personal record or a goal can't target a rest
 * exercise (there's no such thing as a rest PR), so both need every rest
 * exercise filtered out, not just reordered — and once rest is gone, the
 * order every caller wants is identical (Runs, HYROX, Exercises, with
 * ExercisePicker's Rest group simply slotting in second when it's present).
 * With three callers now wanting the same order, and two of them also
 * needing the same filter, both belong here rather than duplicated three
 * times over — see this function's own `options` param.
 */
export function groupExercisesForSelect<T extends GroupableExercise>(
  catalog: readonly T[],
  options: {
    /** false removes every rest-category exercise from the result
     * entirely — not just reordered — for a picker whose subject can never
     * legitimately be a rest exercise (PersonalRecordFields, GoalFields).
     * Defaults to true, the workout builder's own case: an item CAN be a
     * rest exercise (category exists precisely for this), so ExercisePicker
     * needs the Rest group. */
    includeRest?: boolean;
  } = {}
): ExerciseSelectGroup<T>[] {
  const { includeRest = true } = options;
  const hyrox: T[] = [];
  const exercise: T[] = [];
  const run: T[] = [];
  const rest: T[] = [];

  for (const item of catalog) {
    if (item.isHyroxStation) hyrox.push(item);
    else if (item.category === "exercise") exercise.push(item);
    else if (item.category === "run") run.push(item);
    else if (includeRest && item.category === "rest") rest.push(item);
  }

  return [
    { label: "Runs", exercises: run },
    { label: "Rest", exercises: rest },
    { label: "HYROX", exercises: hyrox },
    { label: "Exercises", exercises: exercise },
  ].filter((group) => group.exercises.length > 0);
}
