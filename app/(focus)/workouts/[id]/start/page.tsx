import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DIFFICULTY_LABELS } from "@/app/(app)/workouts/difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "@/app/(app)/workouts/primary-type-labels";
import { requireUser } from "@/lib/auth";
import { getUserContext } from "@/lib/user-settings";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/uuid";
import StartWorkoutClient from "./StartWorkoutClient";

export const metadata: Metadata = {
  title: "Start Workout",
};

/**
 * Start Workout Mode: a full-screen page (it lives in the (focus) route group,
 * so it renders without the sidebar and bottom bar) showing the workout's
 * blocks and items in order, each item checkable, with a session clock that
 * runs from the moment the page opens. 404s under the same conditions as the
 * detail page: missing id, malformed id, or a workout owned by a different
 * user.
 *
 * Stays a Server Component that only fetches the workout — the checklist,
 * the clock and their localStorage-backed state live entirely in the
 * StartWorkoutClient boundary below, since none of that state has any reason
 * to touch the server until Finish sends the active duration.
 */
export default async function StartWorkoutPage(
  props: PageProps<"/workouts/[id]/start">
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

  return (
    <StartWorkoutClient
      workout={workout}
      unitSystem={unitSystem}
      typeLabel={PRIMARY_TYPE_LABELS[workout.primaryType].label}
      difficultyLabel={DIFFICULTY_LABELS[workout.difficulty].label}
    />
  );
}
