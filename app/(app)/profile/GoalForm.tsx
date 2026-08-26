import { getExerciseCatalog } from "@/lib/exercises";
import GoalFields from "./GoalFields";

/**
 * Fetches the data the add-goal form needs (the exercise catalog, for
 * personal_record goals) and hands it to GoalFields — the actual form is a
 * client component because useActionState (for inline validation-error
 * display) and the goal-type-driven field visibility both require one;
 * this wrapper stays a Server Component so the data fetching itself
 * doesn't need to move to the client. Same split as
 * PersonalRecordForm/PersonalRecordFields. Unlike personal records/body
 * metrics, goals carry no date field, so there's no need for today's date
 * here — addGoal (goals-actions.ts) fetches it itself for validation.
 */
export default async function GoalForm() {
  const catalog = await getExerciseCatalog();

  return <GoalFields catalog={catalog} />;
}
