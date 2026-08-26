import { getCurrentDateString } from "@/lib/scheduled-workouts";
import BodyMetricFields from "./BodyMetricFields";

/**
 * Fetches today's date and hands it to BodyMetricFields — the actual form
 * is a client component because useActionState (for inline
 * validation-error display) requires one; this wrapper stays a Server
 * Component so the date fetch itself doesn't need to move to the client.
 */
export default async function BodyMetricForm() {
  const today = await getCurrentDateString();

  return <BodyMetricFields today={today} />;
}
