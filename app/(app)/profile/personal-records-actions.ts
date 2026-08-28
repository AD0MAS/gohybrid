"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getExerciseById } from "@/lib/exercises";
import {
  createPersonalRecordForUser,
  deletePersonalRecordForUser,
} from "@/lib/personal-records";
import { validatePersonalRecordInput } from "@/lib/personal-records-validation";
import { convertDistanceInputToMetres, convertWeightInputToKg } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";

export type PersonalRecordFormState =
  | { status: "idle" }
  | { status: "error"; error: string }
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
 * Under imperial, a weight record was typed in lb and a distance record in
 * ft (or m, if the chosen exercise is a HYROX station — see
 * resolveDistanceInputUnit in lib/units.ts, which the isHyroxStation
 * lookup below feeds). Both convert here, before validatePersonalRecordInput,
 * so the validator (and the database) only ever see metric — reps/time
 * never convert. Revalidates /profile on success.
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

  let isHyroxStation = false;
  if (typeof exerciseId === "string" && exerciseId !== "") {
    const exercise = await getExerciseById(exerciseId);
    isHyroxStation = exercise?.isHyroxStation ?? false;
  }

  let value: unknown = rawValue;
  if (typeof rawValue === "string" && rawValue !== "") {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      if (recordType === "weight") {
        value = convertWeightInputToKg(parsed, unitSystem);
      } else if (recordType === "distance") {
        value = convertDistanceInputToMetres(parsed, unitSystem, isHyroxStation);
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
    today
  );

  if (!result.success) {
    return { status: "error", error: result.error };
  }

  await createPersonalRecordForUser(user.id, result.data);

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
