import { requireUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { getUserContext } from "@/lib/user-settings";
import PersonalRecordFields from "./PersonalRecordFields";

/**
 * Fetches the data the add-record form needs (the exercise catalog and
 * today's date, in the user's own timezone via getUserContext — cached,
 * shared with BodyMetricForm/GoalsList/EventsList within the same
 * request) and hands it to PersonalRecordFields — the actual form is a
 * client component because useActionState (for inline validation-error
 * display) and the record-type/exercise-choice interactivity both require
 * one; this wrapper stays a Server Component so the data fetching itself
 * doesn't need to move to the client.
 */
export default async function PersonalRecordForm() {
  const user = await requireUser();
  const [catalog, { today }] = await Promise.all([
    getExerciseCatalog(),
    getUserContext(user.id),
  ]);

  return <PersonalRecordFields catalog={catalog} today={today} />;
}
