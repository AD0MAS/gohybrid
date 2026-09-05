import { getUserContext } from "@/lib/user-settings";
import BodyMetricFields from "./BodyMetricFields";

type BodyMetricFormProps = {
  userId: string;
};

/**
 * Fetches today's date and unitSystem (via getUserContext — cached, shared
 * with BodyMetricsList/GoalsList/EventsList/PersonalRecordForm within the
 * same request) and hands them to BodyMetricFields — the actual form is a
 * client component because useActionState (for inline validation-error
 * display) requires one; this wrapper stays a Server Component so the data
 * fetch itself doesn't need to move to the client. `unitSystem` only
 * drives the input's displayed unit — the actual metric conversion happens
 * server-side in addBodyMetric (body-metrics-actions.ts), never here.
 * `userId` arrives as a prop from ProfilePage rather than a local
 * requireUser() call — same pattern as /stats.
 */
export default async function BodyMetricForm({ userId }: BodyMetricFormProps) {
  const { today, unitSystem } = await getUserContext(userId);

  return <BodyMetricFields today={today} unitSystem={unitSystem} />;
}
