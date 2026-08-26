import { requireUser } from "@/lib/auth";
import { getUserContext } from "@/lib/user-settings";
import BodyMetricFields from "./BodyMetricFields";

/**
 * Fetches today's date and unitSystem (via getUserContext — cached, shared
 * with BodyMetricsList/GoalsList/EventsList/PersonalRecordForm within the
 * same request) and hands them to BodyMetricFields — the actual form is a
 * client component because useActionState (for inline validation-error
 * display) requires one; this wrapper stays a Server Component so the data
 * fetch itself doesn't need to move to the client. `unitSystem` only
 * drives the input's displayed unit — the actual metric conversion happens
 * server-side in addBodyMetric (body-metrics-actions.ts), never here.
 */
export default async function BodyMetricForm() {
  const user = await requireUser();
  const { today, unitSystem } = await getUserContext(user.id);

  return <BodyMetricFields today={today} unitSystem={unitSystem} />;
}
