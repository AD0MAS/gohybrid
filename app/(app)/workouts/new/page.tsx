import type { Metadata } from "next";
import { BLOCK_TYPES, TARGET_PRESETS, TARGET_TYPES, VOLUME_TYPES, WORKOUT_DIFFICULTIES, WORKOUT_PRIMARY_TYPES } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { getTagCatalog } from "@/lib/tags";
import { getUserContext } from "@/lib/user-settings";
import {
  resolveBackDestination,
  type BackDestination,
} from "../../_components/back-destination";
import { PAGE_MAIN_CLASSES } from "../../_components/shared-classes";
import WorkoutBuilder from "../builder/WorkoutBuilder";

export const metadata: Metadata = {
  title: "New Workout",
};

const DEFAULT_BACK: BackDestination = {
  href: "/workouts",
  label: "Workouts",
};

/** Where the `from` search param can send the back link, keyed by the value
 * each entry point passes — see resolveBackDestination for why `from` is
 * looked up here rather than trusted directly. Same shape as /history and
 * /workouts/[id]'s own BACK_SOURCES. */
const BACK_SOURCES: Record<string, BackDestination> = {
  home: { href: "/", label: "Home" },
};

/**
 * Workout builder entry point — the only way to create a workout. Enum
 * values, the exercise catalog, and the tag
 * catalog are read here, server-side, and passed down as plain data so
 * the client builder never needs to import db/schema.ts or query the
 * database itself. All editing happens in the builder's client state;
 * Save doesn't persist anything yet.
 *
 * Reachable from /workouts' "New workout" corner button (no `from`,
 * DEFAULT_BACK) and from Home's Quick Actions ("New workout", `from=home`)
 * — same `from`-param BackLink pattern as /workouts/[id] and /history now
 * that there's more than one entry point (see back-destination.ts).
 */
export default async function NewWorkoutPage(
  props: PageProps<"/workouts/new">
) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const back = resolveBackDestination(searchParams.from, BACK_SOURCES, DEFAULT_BACK);
  const [exerciseCatalog, tagCatalog, { unitSystem }] = await Promise.all([
    getExerciseCatalog(),
    getTagCatalog(),
    getUserContext(user.id),
  ]);

  return (
    <main className={PAGE_MAIN_CLASSES}>
      <WorkoutBuilder
        heading="New workout"
        backHref={back.href}
        backLabel={back.label}
        discardHref={back.href}
        primaryTypeOptions={WORKOUT_PRIMARY_TYPES}
        difficultyOptions={WORKOUT_DIFFICULTIES}
        blockTypeOptions={BLOCK_TYPES}
        volumeTypeOptions={VOLUME_TYPES}
        targetTypeOptions={TARGET_TYPES}
        targetPresetOptions={TARGET_PRESETS}
        exerciseCatalog={exerciseCatalog}
        tagCatalog={tagCatalog}
        unitSystem={unitSystem}
      />
    </main>
  );
}
