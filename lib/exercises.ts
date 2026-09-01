import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";

// groupExercisesForSelect/GroupableExercise/ExerciseSelectGroup live in
// lib/exercise-groups.ts instead of here, even though this file is their
// natural conceptual home — this module imports `db`, and PersonalRecordFields/
// GoalFields/ExercisePicker are client components that need the grouping
// helper without pulling Drizzle/`postgres` into the browser bundle. See
// that file's own top-of-file comment.

/**
 * Fetches the full exercise catalog, ordered by name. The catalog is
 * small (currently ~43 rows) and not user-scoped, so callers — the
 * workout builder — filter it client-side rather than querying per
 * keystroke.
 */
export async function getExerciseCatalog() {
  return db.select().from(exercises).orderBy(asc(exercises.name));
}

/**
 * Fetches a single exercise by id, or null if it doesn't exist. Used by
 * the Goals write path (goals-actions.ts) to look up `isHyroxStation` for
 * a personal_record goal's target exercise, needed only to format the
 * "already complete" rejection message (checkGoalNotAlreadyMet) — the
 * actual distance conversion no longer needs it, since DistanceInput
 * submits its unit explicitly (see convertDistanceInputToMetres in
 * lib/units.ts).
 */
export async function getExerciseById(id: string) {
  const [exercise] = await db.select().from(exercises).where(eq(exercises.id, id));
  return exercise ?? null;
}
