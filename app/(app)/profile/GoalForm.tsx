import { requireUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { getUserContext } from "@/lib/user-settings";
import GoalFields from "./GoalFields";

/**
 * Fetches the data the add-goal form needs (the exercise catalog — each
 * row already carries isHyroxStation, since getExerciseCatalog selects
 * full rows — and unitSystem via getUserContext, cached and shared with
 * GoalsList/BodyMetricForm/PersonalRecordForm within the same request)
 * and hands them to GoalFields — the actual form is a client component
 * because useActionState (for inline validation-error display) and the
 * goal-type-driven field visibility both require one; this wrapper stays
 * a Server Component so the data fetching itself doesn't need to move to
 * the client. Same split as PersonalRecordForm/PersonalRecordFields.
 * Unlike personal records/body metrics, goals carry no date field, so
 * there's no need for today's date here — addGoal (goals-actions.ts)
 * fetches it itself for validation. `unitSystem` only drives the
 * targetValue/startValue placeholders' displayed unit — the actual metric
 * conversion happens server-side in addGoal, never here.
 */
export default async function GoalForm() {
  const user = await requireUser();
  const [catalog, { unitSystem }] = await Promise.all([
    getExerciseCatalog(),
    getUserContext(user.id),
  ]);

  return <GoalFields catalog={catalog} unitSystem={unitSystem} />;
}
