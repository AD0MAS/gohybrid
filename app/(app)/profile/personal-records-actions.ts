"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createPersonalRecordForUser,
  deletePersonalRecordForUser,
} from "@/lib/personal-records";
import { validatePersonalRecordInput } from "@/lib/personal-records-validation";
import { getUserContext } from "@/lib/user-settings";

export type PersonalRecordFormState = { error: string | null };

/**
 * Records a new personal record for the authenticated user. Passed to
 * useActionState in PersonalRecordFields, so a validation failure is an
 * expected outcome of a form submission — it returns { error } for the
 * form to render, rather than throwing (which would hit app/error.tsx and
 * replace the whole page). Genuine unexpected failures (e.g. a DB error
 * from createPersonalRecordForUser) still throw and belong to the error
 * boundary. `today` for the "not in the future" check comes from
 * getUserContext — the user's own calendar day, not the database's UTC
 * `current_date` — same ground truth used everywhere else date validity is
 * judged against "today". Revalidates /profile on success.
 */
export async function addPersonalRecord(
  _prevState: PersonalRecordFormState,
  formData: FormData
): Promise<PersonalRecordFormState> {
  const user = await requireUser();
  const { today } = await getUserContext(user.id);

  const result = validatePersonalRecordInput(
    {
      exerciseId: formData.get("exerciseId"),
      customName: formData.get("customName"),
      recordType: formData.get("recordType"),
      value: formData.get("value"),
      achievedAt: formData.get("achievedAt"),
      notes: formData.get("notes"),
    },
    today
  );

  if (!result.success) {
    return { error: result.error };
  }

  await createPersonalRecordForUser(user.id, result.data);

  revalidatePath("/profile");
  return { error: null };
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
