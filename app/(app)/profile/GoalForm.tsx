import { getExerciseCatalog } from "@/lib/exercises";
import { getDistinctCustomNamesForUser } from "@/lib/personal-records";
import { getUserContext } from "@/lib/user-settings";
import GoalFields from "./GoalFields";

type GoalFormProps = {
  userId: string;
};

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
 * conversion happens server-side in addGoal, never here. `customNames`
 * (this user's distinct past custom_name values) mirrors
 * PersonalRecordForm's own fetch, for the same "previously used" group in
 * GoalFields' personal_record target-exercise <select>.
 *
 * `userId` arrives as a prop from ProfilePage rather than a local
 * requireUser() call — the page authenticates once and passes it down to
 * every section, same pattern as /stats (see SummaryCards etc.), instead
 * of each section re-checking auth on its own.
 */
export default async function GoalForm({ userId }: GoalFormProps) {
  const [catalog, customNames, { unitSystem }] = await Promise.all([
    getExerciseCatalog(),
    getDistinctCustomNamesForUser(userId),
    getUserContext(userId),
  ]);

  return (
    <GoalFields catalog={catalog} customNames={customNames} unitSystem={unitSystem} />
  );
}
