import { getExerciseCatalog } from "@/lib/exercises";
import { getCurrentDateString } from "@/lib/scheduled-workouts";
import PersonalRecordFields from "./PersonalRecordFields";

/**
 * Fetches the data the add-record form needs (the exercise catalog and
 * today's date) and hands it to PersonalRecordFields — the actual form is
 * a client component because useActionState (for inline validation-error
 * display) and the record-type/exercise-choice interactivity both require
 * one; this wrapper stays a Server Component so the data fetching itself
 * doesn't need to move to the client.
 */
export default async function PersonalRecordForm() {
  const [catalog, today] = await Promise.all([
    getExerciseCatalog(),
    getCurrentDateString(),
  ]);

  return <PersonalRecordFields catalog={catalog} today={today} />;
}
