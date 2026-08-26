import { requireUser } from "@/lib/auth";
import { getUserContext } from "@/lib/user-settings";
import BodyMetricFields from "./BodyMetricFields";

/**
 * Fetches today's date (in the user's own timezone, via getUserContext —
 * cached, shared with BodyMetricsList/GoalsList/EventsList/
 * PersonalRecordForm within the same request) and hands it to
 * BodyMetricFields — the actual form is a client component because
 * useActionState (for inline validation-error display) requires one; this
 * wrapper stays a Server Component so the date fetch itself doesn't need
 * to move to the client.
 */
export default async function BodyMetricForm() {
  const user = await requireUser();
  const { today } = await getUserContext(user.id);

  return <BodyMetricFields today={today} />;
}
