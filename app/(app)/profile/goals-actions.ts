"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getExerciseById } from "@/lib/exercises";
import {
  createGoalForUser,
  deleteGoalForUser,
  setGoalArchivedForUser,
} from "@/lib/goals";
import { validateGoalInput } from "@/lib/goals-validation";
import { convertDistanceInputToMetres, convertWeightInputToKg } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";

export type GoalFormState = { error: string | null };

/**
 * Creates a new goal for the authenticated user. Passed to useActionState
 * in GoalFields, so a validation failure is an expected outcome of a form
 * submission — it returns { error } for the form to render, rather than
 * throwing (which would hit app/error.tsx and replace the whole page).
 * Genuine unexpected failures (e.g. a DB error from createGoalForUser)
 * still throw and belong to the error boundary.
 *
 * Under imperial, a body_metric weight goal's targetValue/startValue was
 * typed in lb, and a personal_record goal's in lb (weight) or ft/m
 * (distance — see resolveDistanceInputUnit in lib/units.ts, fed by the
 * same isHyroxStation lookup the Personal Records write path uses).
 * session_count and streak goals never convert. Both fields go through
 * convertGoalValue, before validateGoalInput, so the validator (and the
 * database) only ever see metric — same principle as
 * addBodyMetric/addPersonalRecord. Revalidates /profile on success.
 */
export async function addGoal(
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const user = await requireUser();
  const { unitSystem } = await getUserContext(user.id);

  const goalType = formData.get("goalType");
  const targetMetricType = formData.get("targetMetricType");
  const targetRecordType = formData.get("targetRecordType");
  const targetExerciseId = formData.get("targetExerciseId");

  let isHyroxStation = false;
  if (
    goalType === "personal_record" &&
    typeof targetExerciseId === "string" &&
    targetExerciseId !== ""
  ) {
    const exercise = await getExerciseById(targetExerciseId);
    isHyroxStation = exercise?.isHyroxStation ?? false;
  }

  function convertGoalValue(raw: FormDataEntryValue | null): unknown {
    if (typeof raw !== "string" || raw === "") return raw;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return raw;

    if (goalType === "body_metric" && targetMetricType === "weight") {
      return convertWeightInputToKg(parsed, unitSystem);
    }
    if (goalType === "personal_record") {
      if (targetRecordType === "weight") {
        return convertWeightInputToKg(parsed, unitSystem);
      }
      if (targetRecordType === "distance") {
        return convertDistanceInputToMetres(parsed, unitSystem, isHyroxStation);
      }
    }
    return parsed;
  }

  const result = validateGoalInput({
    title: formData.get("title"),
    goalType,
    direction: formData.get("direction"),
    period: formData.get("period"),
    targetValue: convertGoalValue(formData.get("targetValue")),
    startValue: convertGoalValue(formData.get("startValue")),
    targetPrimaryType: formData.get("targetPrimaryType"),
    targetMetricType,
    targetExerciseId,
    targetCustomName: formData.get("targetCustomName"),
    targetRecordType,
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
