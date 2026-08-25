"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createBodyMetricForUser,
  deleteBodyMetricForUser,
} from "@/lib/body-metrics";
import { validateBodyMetricInput } from "@/lib/body-metrics-validation";
import { getCurrentDateString } from "@/lib/scheduled-workouts";

/**
 * Records a new body metric measurement for the authenticated user, from
 * the /profile add-measurement form. `today` for the "not in the future"
 * check comes from the database (see getCurrentDateString), same ground
 * truth used everywhere else date validity is judged against "today".
 * Revalidates /profile on success.
 */
export async function addBodyMetric(formData: FormData) {
  const user = await requireUser();
  const today = await getCurrentDateString();

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
    throw new Error(result.error);
  }

  await createBodyMetricForUser(user.id, result.data);

  revalidatePath("/profile");
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
