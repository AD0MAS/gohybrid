"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createBodyMetricForUser,
  deleteBodyMetricForUser,
  updateBodyMetricForUser,
} from "@/lib/body-metrics";
import { validateBodyMetricInput } from "@/lib/body-metrics-validation";
import { convertWeightInputToKg } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import { echoFormValues } from "@/lib/form-state";

export type BodyMetricFormState =
  | { status: "idle" }
  | { status: "error"; error: string; values: Record<string, string> }
  | { status: "success" };

/**
 * Records a new body metric measurement for the authenticated user. Passed
 * to useActionState in BodyMetricFields, so a validation failure is an
 * expected outcome of a form submission — it returns { status: "error",
 * error } for the form to render, rather than throwing (which would hit
 * app/error.tsx and replace the whole page). { status: "success" } lets
 * the add-measurement modal tell "nothing has happened yet" apart from
 * "saved", closing itself only once a save actually went through. Genuine
 * unexpected failures (e.g. a DB error from createBodyMetricForUser) still
 * throw and belong to the error boundary. `today` for the "not in the
 * future" check comes from getUserContext — the user's own calendar day, not the database's UTC
 * `current_date` — same ground truth used everywhere else date validity is
 * judged against "today".
 *
 * Under imperial, a weight measurement was typed in lb (see
 * BodyMetricFields' placeholder) — convertWeightInputToKg runs here,
 * before validateBodyMetricInput, so the validator (and the database)
 * only ever see kg. body_fat/resting_hr never convert (see
 * lib/units.ts). Revalidates /profile on success.
 */
export async function addBodyMetric(
  _prevState: BodyMetricFormState,
  formData: FormData
): Promise<BodyMetricFormState> {
  const user = await requireUser();
  const { today, unitSystem } = await getUserContext(user.id);

  const metricType = formData.get("metricType");
  const rawValue = formData.get("value");

  let value: unknown = rawValue;
  if (metricType === "weight" && typeof rawValue === "string" && rawValue !== "") {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      value = convertWeightInputToKg(parsed, unitSystem);
    }
  }

  const result = validateBodyMetricInput(
    {
      metricType,
      value,
      measuredAt: formData.get("measuredAt"),
      notes: formData.get("notes"),
    },
    today,
    unitSystem
  );

  if (!result.success) {
    return {
      status: "error",
      error: result.error,
      values: echoFormValues(formData),
    };
  }

  await createBodyMetricForUser(user.id, result.data);

  revalidatePath("/profile");
  return { status: "success" };
}

/**
 * Updates one of the authenticated user's body metrics, bound with the id
 * via .bind(null, id) so the resulting function matches useActionState's
 * (prevState, formData) signature exactly — same imperial→metric
 * conversion and validation as addBodyMetric (an update has the same
 * rules as a create), against BodyMetricFields' entry-populated form
 * instead of an empty one. Ownership is enforced by
 * updateBodyMetricForUser's WHERE clause; a null result (wrong id or
 * another user's row) throws, same as deleteBodyMetric, since a forged id
 * can't silently no-op. Revalidates /profile on success.
 */
export async function updateBodyMetric(
  id: string,
  _prevState: BodyMetricFormState,
  formData: FormData
): Promise<BodyMetricFormState> {
  const user = await requireUser();
  const { today, unitSystem } = await getUserContext(user.id);

  const metricType = formData.get("metricType");
  const rawValue = formData.get("value");

  let value: unknown = rawValue;
  if (metricType === "weight" && typeof rawValue === "string" && rawValue !== "") {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      value = convertWeightInputToKg(parsed, unitSystem);
    }
  }

  const result = validateBodyMetricInput(
    {
      metricType,
      value,
      measuredAt: formData.get("measuredAt"),
      notes: formData.get("notes"),
    },
    today,
    unitSystem
  );

  if (!result.success) {
    return {
      status: "error",
      error: result.error,
      values: echoFormValues(formData),
    };
  }

  const updated = await updateBodyMetricForUser(id, user.id, result.data);
  if (!updated) {
    throw new Error("Body metric not found.");
  }

  revalidatePath("/profile");
  return { status: "success" };
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
