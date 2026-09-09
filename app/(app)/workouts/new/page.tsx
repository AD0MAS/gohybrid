import type { Metadata } from "next";
import {
  blockTypeEnum,
  targetPresetEnum,
  targetTypeEnum,
  volumeTypeEnum,
  workoutDifficultyEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { getTagCatalog } from "@/lib/tags";
import { getUserContext } from "@/lib/user-settings";
import BackLink from "../../_components/BackLink";
import {
  resolveBackDestination,
  type BackDestination,
} from "../../_components/back-destination";
import WorkoutBuilder from "../builder/WorkoutBuilder";

export const metadata: Metadata = {
  title: "New Workout",
};

const DEFAULT_BACK: BackDestination = { href: "/workouts", label: "Workouts" };

/** Where the `from` search param can send the back link, keyed by the value
 * each entry point passes — see resolveBackDestination for why `from` is
 * looked up here rather than trusted directly. */
const BACK_SOURCES: Record<string, BackDestination> = {
  library: { href: "/workouts/library", label: "My Workouts" },
};

/**
 * Workout builder entry point — the only way to create a workout. Enum
 * values, the exercise catalog, and the tag
 * catalog are read here, server-side, and passed down as plain data so
 * the client builder never needs to import db/schema.ts or query the
 * database itself. All editing happens in the builder's client state;
 * Save doesn't persist anything yet.
 *
 * Reachable from both /workouts and /workouts/library, so the hierarchical
 * back link can't have one fixed parent the way most pages do — the `from`
 * search param, set by each entry point's own link, picks it instead (see
 * resolveBack above). An absent or unrecognised value defaults to /workouts.
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
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center gap-2">
          <BackLink href={back.href} label={back.label} />
          <h1 className="text-xl font-semibold">New workout</h1>
        </div>

        <WorkoutBuilder
          primaryTypeOptions={workoutPrimaryTypeEnum.enumValues}
          difficultyOptions={workoutDifficultyEnum.enumValues}
          blockTypeOptions={blockTypeEnum.enumValues}
          volumeTypeOptions={volumeTypeEnum.enumValues}
          targetTypeOptions={targetTypeEnum.enumValues}
          targetPresetOptions={targetPresetEnum.enumValues}
          exerciseCatalog={exerciseCatalog}
          tagCatalog={tagCatalog}
          unitSystem={unitSystem}
        />
      </div>
    </main>
  );
}
