"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createBodyMetricForUser,
  deleteBodyMetricForUser,
} from "@/lib/body-metrics";
import { validateBodyMetricInput } from "@/lib/body-metrics-validation";
import { getUserContext } from "@/lib/user-settings";

export type BodyMetricFormState = { error: string | null };

/**
 * Records a new body metric measurement for the authenticated user. Passed
 * to useActionState in BodyMetricFields, so a validation failure is an
 * expected outcome of a form submission — it returns { error } for the
 * form to render, rather than throwing (which would hit app/error.tsx and
 * replace the whole page). Genuine unexpected failures (e.g. a DB error
 * from createBodyMetricForUser) still throw and belong to the error
 * boundary. `today` for the "not in the future" check comes from
 * getUserContext — the user's own calendar day, not the database's UTC
 * `current_date` — same ground truth used everywhere else date validity is
 * judged against "today". Revalidates /profile on success.
 */
export async function addBodyMetric(
  _prevState: BodyMetricFormState,
  formData: FormData
): Promise<BodyMetricFormState> {
  const user = await requireUser();
  const { today } = await getUserContext(user.id);

  const result = validateBodyMetricInput(
    {
      metricType: formData.get("metricType"),
      value: formData.get("value"),
      measuredAt: formData.get("measuredAt"),
      notes: formData.get("notes"),
    },
    today
  );

  if (!result.success) {
    return { error: result.error };
  }

  await createBodyMetricForUser(user.id, result.data);

  revalidatePath("/profile");
  return { error: null };
}

/**
 * Deletes one of the authenticated user's body metrics, bound with the id
 * via .bind(null, id) from /profile. Ownership is enforced by
 * deleteBodyMetricForUser's WHERE clause. Throws if nothing matched, so a
 * forged id can't silently no-op. Revalidates /profile on success.
 */
export async function deleteBodyMetric(id: string) {
  const user = await requireUser();

  const deleted = await deleteBodyMetricForUser(id, user.id);

  if (!deleted) {
    throw new Error("Body metric not found.");
  }

  revalidatePath("/profile");
}
