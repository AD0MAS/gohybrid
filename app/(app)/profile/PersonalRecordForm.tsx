import { getExerciseCatalog } from "@/lib/exercises";
import { getDistinctCustomNamesForUser } from "@/lib/personal-records";
import { getUserContext } from "@/lib/user-settings";
import PersonalRecordFields from "./PersonalRecordFields";

type PersonalRecordFormProps = {
  userId: string;
};

/**
 * Fetches the data the add-record form needs (the exercise catalog — each
 * row already carries isHyroxStation, since getExerciseCatalog selects
 * full rows — this user's distinct past custom_name values, and today's
 * date, in the user's own timezone via getUserContext — cached, shared
 * with BodyMetricForm/GoalsList/EventsList within the same request) and
 * hands it to PersonalRecordFields — the actual form is a client component
 * because useActionState (for inline validation-error display) and the
 * record-type/exercise-choice interactivity both require one; this
 * wrapper stays a Server Component so the data fetching itself doesn't
 * need to move to the client. `unitSystem` only drives the input's
 * displayed unit — the actual metric conversion happens server-side in
 * addPersonalRecord (personal-records-actions.ts), never here. `userId`
 * arrives as a prop from ProfilePage rather than a local requireUser()
 * call — same pattern as /stats.
 */
export default async function PersonalRecordForm({
  userId,
}: PersonalRecordFormProps) {
  const [catalog, customNames, { today, unitSystem }] = await Promise.all([
    getExerciseCatalog(),
    getDistinctCustomNamesForUser(userId),
    getUserContext(userId),
  ]);

  return (
    <PersonalRecordFields
      catalog={catalog}
      customNames={customNames}
      today={today}
      unitSystem={unitSystem}
    />
  );
}
