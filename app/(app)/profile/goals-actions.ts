"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createGoalForUser,
  deleteGoalForUser,
  setGoalArchivedForUser,
} from "@/lib/goals";
import { validateGoalInput } from "@/lib/goals-validation";

export type GoalFormState = { error: string | null };

/**
 * Creates a new goal for the authenticated user. Passed to useActionState
 * in GoalFields, so a validation failure is an expected outcome of a form
 * submission — it returns { error } for the form to render, rather than
 * throwing (which would hit app/error.tsx and replace the whole page).
 * Genuine unexpected failures (e.g. a DB error from createGoalForUser)
 * still throw and belong to the error boundary. Revalidates /profile on
 * success.
 */
export async function addGoal(
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const user = await requireUser();

  const result = validateGoalInput({
    title: formData.get("title"),
    goalType: formData.get("goalType"),
    direction: formData.get("direction"),
    period: formData.get("period"),
    targetValue: formData.get("targetValue"),
    startValue: formData.get("startValue"),
    targetPrimaryType: formData.get("targetPrimaryType"),
    targetMetricType: formData.get("targetMetricType"),
    targetExerciseId: formData.get("targetExerciseId"),
    targetCustomName: formData.get("targetCustomName"),
    targetRecordType: formData.get("targetRecordType"),
  });

  if (!result.success) {
    return { error: result.error };
  }

  await createGoalForUser(user.id, result.data);

  revalidatePath("/profile");
  return { error: null };
}

/**
 * Deletes one of the authenticated user's goals, bound with the id via
 * .bind(null, id) from /profile. Ownership is enforced by
 * deleteGoalForUser's WHERE clause. Throws if nothing matched, so a forged
 * id can't silently no-op. Revalidates /profile on success.
 */
export async function deleteGoal(id: string) {
  const user = await requireUser();

  const deleted = await deleteGoalForUser(id, user.id);

  if (!deleted) {
    throw new Error("Goal not found.");
  }

  revalidatePath("/profile");
}

/**
 * Sets a goal's archived flag, bound with (id, isArchived) from /profile —
 * one action for both the Archive and Unarchive buttons. Ownership is
 * enforced by setGoalArchivedForUser's WHERE clause. Throws if nothing
 * matched. Revalidates /profile on success.
 */
export async function setGoalArchived(id: string, isArchived: boolean) {
  const user = await requireUser();

  const updated = await setGoalArchivedForUser(id, user.id, isArchived);

  if (!updated) {
    throw new Error("Goal not found.");
  }

  revalidatePath("/profile");
}
