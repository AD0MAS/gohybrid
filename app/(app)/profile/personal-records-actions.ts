"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createPersonalRecordForUser,
  deletePersonalRecordForUser,
  updatePersonalRecordForUser,
} from "@/lib/personal-records";
import { validatePersonalRecordInput } from "@/lib/personal-records-validation";
import {
  convertDistanceInputToMetres,
  convertWeightInputToKg,
  DISTANCE_INPUT_UNITS,
} from "@/lib/units";
import { isOneOf } from "@/lib/workouts-validation";
import { getUserContext } from "@/lib/user-settings";
import { echoFormValues } from "@/lib/form-state";

export type PersonalRecordFormState =
  | { status: "idle" }
  | { status: "error"; error: string; values: Record<string, string> }
  | { status: "success" };

/**
 * Records a new personal record for the authenticated user. Passed to
 * useActionState in PersonalRecordFields, so a validation failure is an
 * expected outcome of a form submission — it returns { status: "error",
 * error } for the form to render, rather than throwing (which would hit
 * app/error.tsx and replace the whole page). { status: "success" } lets
 * the add-record modal tell "nothing has happened yet" apart from "saved",
 * closing itself only once a save actually went through. Genuine
 * unexpected failures (e.g. a DB error from createPersonalRecordForUser)
 * still throw and belong to the error boundary. `today` for the "not in
 * the future" check comes from
 * getUserContext — the user's own calendar day, not the database's UTC
 * `current_date` — same ground truth used everywhere else date validity is
 * judged against "today".
 *
 * Under imperial, a weight record was typed in lb — convertWeightInputToKg
 * still infers that from unitSystem, since the weight field has no unit
 * selector of its own. A distance record instead carries its unit
 * explicitly: DistanceInput (app/(app)/_components/DistanceInput.tsx)
 * submits the typed number under "value" and the unit the user picked
 * under "valueUnit" (m/km/ft/mi — DISTANCE_INPUT_UNITS in lib/units.ts),
 * so convertDistanceInputToMetres converts using that submitted unit
 * rather than inferring one. Both convert here, before
 * validatePersonalRecordInput, so the validator (and the database) only
 * ever see metric — reps/time never convert. Revalidates /profile on
 * success.
 */
export async function addPersonalRecord(
  _prevState: PersonalRecordFormState,
  formData: FormData
): Promise<PersonalRecordFormState> {
  const user = await requireUser();
  const { today, unitSystem } = await getUserContext(user.id);

  const exerciseId = formData.get("exerciseId");
  const recordType = formData.get("recordType");
  const rawValue = formData.get("value");
  const rawValueUnit = formData.get("valueUnit");

  let value: unknown = rawValue;
  if (typeof rawValue === "string" && rawValue !== "") {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      if (recordType === "weight") {
        value = convertWeightInputToKg(parsed, unitSystem);
      } else if (
        recordType === "distance" &&
        isOneOf(rawValueUnit, DISTANCE_INPUT_UNITS)
      ) {
        value = convertDistanceInputToMetres(parsed, rawValueUnit);
      }
    }
  }

  const result = validatePersonalRecordInput(
    {
      exerciseId,
      customName: formData.get("customName"),
      recordType,
      value,
      achievedAt: formData.get("achievedAt"),
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

  await createPersonalRecordForUser(user.id, result.data);

  revalidatePath("/profile");
  return { status: "success" };
}

/**
 * Updates one of the authenticated user's personal records, bound with the
 * id via .bind(null, id) so the resulting function matches
 * useActionState's (prevState, formData) signature exactly — same
 * imperial→metric conversion and validation as addPersonalRecord (an
 * update has the same rules as a create), against PersonalRecordFields'
 * entry-populated form instead of an empty one. Ownership is enforced by
 * updatePersonalRecordForUser's WHERE clause; a null result (wrong id or
 * another user's row) throws, same as deletePersonalRecord, since a
 * forged id can't silently no-op. Revalidates /profile on success.
 */
export async function updatePersonalRecord(
  id: string,
  _prevState: PersonalRecordFormState,
  formData: FormData
): Promise<PersonalRecordFormState> {
  const user = await requireUser();
  const { today, unitSystem } = await getUserContext(user.id);

  const exerciseId = formData.get("exerciseId");
  const recordType = formData.get("recordType");
  const rawValue = formData.get("value");
  const rawValueUnit = formData.get("valueUnit");

  let value: unknown = rawValue;
  if (typeof rawValue === "string" && rawValue !== "") {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      if (recordType === "weight") {
        value = convertWeightInputToKg(parsed, unitSystem);
      } else if (
        recordType === "distance" &&
        isOneOf(rawValueUnit, DISTANCE_INPUT_UNITS)
      ) {
        value = convertDistanceInputToMetres(parsed, rawValueUnit);
      }
    }
  }

  const result = validatePersonalRecordInput(
    {
      exerciseId,
      customName: formData.get("customName"),
      recordType,
      value,
      achievedAt: formData.get("achievedAt"),
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

  const updated = await updatePersonalRecordForUser(id, user.id, result.data);
  if (!updated) {
    throw new Error("Personal record not found.");
  }

  revalidatePath("/profile");
  return { status: "success" };
}

/**
 * Deletes one of the authenticated user's personal records, bound with the
 * id via .bind(null, id) from /profile. Ownership is enforced by
 * deletePersonalRecordForUser's WHERE clause. Throws if nothing matched, so
 * a forged id can't silently no-op. Revalidates /profile on success.
 */
export async function deletePersonalRecord(id: string) {
  const user = await requireUser();

  const deleted = await deletePersonalRecordForUser(id, user.id);

  if (!deleted) {
    throw new Error("Personal record not found.");
  }

  revalidatePath("/profile");
}
