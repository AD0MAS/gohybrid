"use server";

import { revalidatePath } from "next/cache";
import { unitSystemEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getExerciseById } from "@/lib/exercises";
import {
  createGoalForUser,
  deleteGoalForUser,
  getGoalForUser,
  resolveCurrentValueForTarget,
  setGoalArchivedForUser,
  updateGoalForUser,
  type GoalTarget,
} from "@/lib/goals";
import { resolveCanonicalCustomName } from "@/lib/personal-records";
import { validateGoalInput, type ValidatedGoalInput } from "@/lib/goals-validation";
import {
  convertDistanceInputToMetres,
  convertWeightInputToKg,
  DISTANCE_INPUT_UNITS,
} from "@/lib/units";
import { isOneOf } from "@/lib/workouts-validation";
import { getUserContext } from "@/lib/user-settings";
import { echoFormValues } from "@/lib/form-state";
import { formatGoalValueText } from "./goal-labels";

export type GoalFormState =
  | { status: "idle" }
  | { status: "error"; error: string; values: Record<string, string> }
  | { status: "success" };

/**
 * Resolves a goal target's current value and rejects one that would already
 * be complete before it's created or re-targeted — extended from the old
 * decrease-only "start value must differ from target" rejection to every
 * goal_type/direction (GOHYBRID_PLAN.md doesn't want a goal that's 100%
 * done the moment it exists). Folds that old check in as a special case:
 * a decrease goal whose resolved current value equals targetValue is
 * "already met" under the current <= target rule below, not a separate
 * equality check.
 *
 * Also doubles as the decrease-direction start_value resolver (its `current`
 * return, once `ok`, is exactly what a decrease goal's start_value must be
 * captured as) — one resolveCurrentValueForTarget call serves both purposes
 * instead of two.
 *
 * Shared by addGoal (called unconditionally, for every goal_type, at
 * creation) and updateGoal's existing re-capture branch (decrease goals
 * whose target subject changed, or that just became decrease — see
 * updateGoal's own comment for why that's the only case it re-runs this).
 *
 * Exemptions and edge cases:
 *   - session_count goals with period "week"/"month" are never rejected,
 *     checked first, before any query runs. The count resets every period,
 *     so already having hit this week's/month's target is the normal,
 *     recurring state of the goal, not a sign it's pointless — only
 *     period "all_time" (and every other goal_type) uses the plain
 *     already-met rule below.
 *   - A null current value (no sessions/measurements/records yet) is never
 *     "already met" for an increase-direction goal — that's exactly what a
 *     fresh goal is for. For decrease, it's reported through the existing
 *     "no data yet" rejection below instead, unchanged from before: a
 *     decrease goal genuinely can't be tracked without a starting point.
 *   - Otherwise: increase is met at current >= target, decrease at
 *     current <= target. streak and session_count (period "all_time") are
 *     always direction "increase" (validateGoalInput enforces this), so
 *     they fall under the same increase rule with no extra case needed.
 */
async function checkGoalNotAlreadyMet(
  target: GoalTarget,
  direction: ValidatedGoalInput["direction"],
  targetValue: number,
  userId: string,
  today: string,
  timezone: string,
  unitSystem: (typeof unitSystemEnum.enumValues)[number],
  isHyroxStation: boolean
): Promise<
  { ok: true; current: number | null } | { ok: false; error: string }
> {
  if (target.goalType === "session_count" && target.period !== "all_time") {
    return { ok: true, current: null };
  }

  const current = await resolveCurrentValueForTarget(
    target,
    userId,
    today,
    timezone
  );

  if (current === null) {
    if (direction === "decrease") {
      return {
        ok: false,
        error:
          target.goalType === "body_metric"
            ? "Add a measurement for this metric before setting a decrease goal."
            : "Add a record for this exercise before setting a decrease goal.",
      };
    }
    return { ok: true, current: null };
  }

  const alreadyMet =
    direction === "increase" ? current >= targetValue : current <= targetValue;
  if (alreadyMet) {
    const formatted = formatGoalValueText(
      {
        goalType: target.goalType,
        targetMetricType: target.targetMetricType,
        targetRecordType: target.targetRecordType,
        exercise: isHyroxStation
          ? { id: "", name: "", isHyroxStation: true }
          : null,
      },
      current,
      unitSystem
    );
    return {
      ok: false,
      error: `This goal is already complete — set a target beyond your current ${formatted}.`,
    };
  }

  return { ok: true, current };
}

/**
 * Converts one raw `targetValue` form field into metric, dispatching on
 * which of a goal's four target types is active. The primitive conversions
 * (convertWeightInputToKg/convertDistanceInputToMetres) already live in
 * lib/units.ts; which one applies, and under what unit, depends on
 * goalType/targetMetricType/targetRecordType/targetValueUnit — goal-specific
 * dispatch, not a unit concern, so it stays here rather than lib/units.ts,
 * same reasoning as checkGoalNotAlreadyMet above. Shared by addGoal and
 * updateGoal, which used to each carry an identical closure-based copy of
 * this same body, capturing these same five values from their own scope
 * instead of taking them as parameters.
 */
function convertGoalValue(
  raw: FormDataEntryValue | null,
  goalType: FormDataEntryValue | null,
  targetMetricType: FormDataEntryValue | null,
  targetRecordType: FormDataEntryValue | null,
  targetValueUnit: FormDataEntryValue | null,
  unitSystem: (typeof unitSystemEnum.enumValues)[number]
): unknown {
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
    if (
      targetRecordType === "distance" &&
      isOneOf(targetValueUnit, DISTANCE_INPUT_UNITS)
    ) {
      return convertDistanceInputToMetres(parsed, targetValueUnit);
    }
  }
  return parsed;
}

/**
 * Creates a new goal for the authenticated user. Passed to useActionState
 * in GoalFields, so a validation failure is an expected outcome of a form
 * submission — it returns { status: "error", error } for the form to
 * render, rather than throwing (which would hit app/error.tsx and replace
 * the whole page). { status: "success" } lets the add-goal modal tell
 * "nothing has happened yet" apart from "saved", closing itself only once
 * a save actually went through. Genuine unexpected failures (e.g. a DB
 * error from createGoalForUser) still throw and belong to the error
 * boundary.
 *
 * Under imperial, a body_metric weight goal's targetValue was typed in lb,
 * and a personal_record weight goal's the same — convertWeightInputToKg
 * still infers lb from unitSystem for both, since neither has a unit
 * selector of its own. A personal_record distance goal instead carries its
 * unit explicitly, the same way a distance personal record does: DistanceInput
 * submits the typed number under "targetValue" and the unit under
 * "targetValueUnit" (m/km/ft/mi), and convertGoalValue converts using that
 * submitted unit rather than inferring one. session_count and streak goals
 * never convert. targetValue goes through convertGoalValue, before
 * validateGoalInput, so the validator (and the database) only ever see
 * metric — same principle as addBodyMetric/addPersonalRecord. A typed
 * targetCustomName is likewise run through resolveCanonicalCustomName
 * (lib/personal-records.ts) before validation, so a personal_record goal
 * targeting "maratonas" reuses whatever spelling that subject's own records
 * were first recorded under, rather than adding a new one.
 *
 * Once validation passes, checkGoalNotAlreadyMet runs unconditionally, for
 * every goal_type and direction — it both rejects an already-complete goal
 * outright and, for a decrease-direction goal, resolves the start_value
 * that's never part of the form itself (see GoalFields' doc comment). Its
 * rejection (no data yet for a decrease target, or already met) is reported
 * the same way a validation failure is. Revalidates /profile on success.
 */
export async function addGoal(
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const user = await requireUser();
  const { unitSystem, today, timezone } = await getUserContext(user.id);

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

  const targetValueUnit = formData.get("targetValueUnit");

  const rawTargetCustomName = formData.get("targetCustomName");
  const targetCustomName =
    typeof rawTargetCustomName === "string" && rawTargetCustomName.trim() !== ""
      ? await resolveCanonicalCustomName(user.id, rawTargetCustomName.trim())
      : rawTargetCustomName;

  const result = validateGoalInput(
    {
      title: formData.get("title"),
      goalType,
      direction: formData.get("direction"),
      period: formData.get("period"),
      targetValue: convertGoalValue(
        formData.get("targetValue"),
        goalType,
        targetMetricType,
        targetRecordType,
        targetValueUnit,
        unitSystem
      ),
      targetPrimaryType: formData.get("targetPrimaryType"),
      targetMetricType,
      targetExerciseId,
      targetCustomName,
      targetRecordType,
    },
    unitSystem
  );

  if (!result.success) {
    return {
      status: "error",
      error: result.error,
      values: echoFormValues(formData),
    };
  }

  const checked = await checkGoalNotAlreadyMet(
    result.data,
    result.data.direction,
    result.data.targetValue,
    user.id,
    today,
    timezone,
    unitSystem,
    isHyroxStation
  );
  if (!checked.ok) {
    return {
      status: "error",
      error: checked.error,
      values: echoFormValues(formData),
    };
  }
  const startValue = result.data.direction === "decrease" ? checked.current : null;

  await createGoalForUser(user.id, { ...result.data, startValue });

  revalidatePath("/profile");
  return { status: "success" };
}

/**
 * Updates one of the authenticated user's goals, bound with the id via
 * .bind(null, id) so the resulting function matches useActionState's
 * (prevState, formData) signature exactly — same conversion and validation
 * as addGoal (an update has the same rules as a create), against
 * GoalFields' entry-populated form instead of an empty one.
 *
 * The existing goal is fetched (also the ownership check — see below) and
 * compared against the freshly validated input, on two different questions
 * that used to be conflated into one (see the "already-met goal can be
 * created by editing" bug this replaced): whether checkGoalNotAlreadyMet
 * needs to re-run at all, and — a narrower question — whether a decrease
 * goal's start_value needs to be re-captured. They're kept as two separate
 * conditions, not one, because they answer different questions:
 *
 *   - checkGoalNotAlreadyMet must re-run (alreadyMetInputsChanged) whenever
 *     the edit changes anything that determines whether the goal is already
 *     met: the target subject (goalType, targetMetricType, targetExerciseId,
 *     targetCustomName, targetRecordType — targetSubjectChanged below),
 *     direction, targetValue, or period. Skipping this whenever none of
 *     those changed is what keeps an already-completed goal editable —
 *     renaming it, for instance, must not re-run a check that would now
 *     reject it.
 *   - start_value only needs re-capturing (targetSubjectChanged ||
 *     becameDecrease) when the anchor point itself is stale: the target
 *     subject changed (the old start_value refers to a different
 *     metric/record/type entirely), or direction just became "decrease"
 *     (an increase goal has no start_value to keep — see the final `else`
 *     below — so switching into "decrease" needs one captured for the first
 *     time). A targetValue-only or period-only edit leaves the anchor valid
 *     even though it does need the already-met check re-run against the
 *     *new* target — that's why this condition is strictly narrower than
 *     alreadyMetInputsChanged rather than reusing it.
 *
 * Both conditions build on the same targetSubjectChanged comparison rather
 * than duplicating those five field checks. Since targetSubjectChanged and
 * a direction change are each already folded into alreadyMetInputsChanged,
 * the narrower start_value condition being true always implies the check
 * already ran — so its resolved current value is reused as start_value
 * instead of calling checkGoalNotAlreadyMet a second time. Otherwise, for
 * an unchanged decrease goal, the existing start_value is carried over as-is.
 * For an increase goal, start_value is always null, whether or not it just
 * switched from "decrease".
 *
 * Ownership is checked twice: once via getGoalForUser (needed anyway, to
 * read the pre-edit target) and again in updateGoalForUser's WHERE clause.
 * Either returning null/not-found throws, same as deleteGoal/setGoalArchived,
 * since a forged id can't silently no-op. Revalidates /profile on success.
 */
export async function updateGoal(
  id: string,
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const user = await requireUser();
  const { unitSystem, today, timezone } = await getUserContext(user.id);

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

  const targetValueUnit = formData.get("targetValueUnit");

  const rawTargetCustomName = formData.get("targetCustomName");
  const targetCustomName =
    typeof rawTargetCustomName === "string" && rawTargetCustomName.trim() !== ""
      ? await resolveCanonicalCustomName(user.id, rawTargetCustomName.trim())
      : rawTargetCustomName;

  const result = validateGoalInput(
    {
      title: formData.get("title"),
      goalType,
      direction: formData.get("direction"),
      period: formData.get("period"),
      targetValue: convertGoalValue(
        formData.get("targetValue"),
        goalType,
        targetMetricType,
        targetRecordType,
        targetValueUnit,
        unitSystem
      ),
      targetPrimaryType: formData.get("targetPrimaryType"),
      targetMetricType,
      targetExerciseId,
      targetCustomName,
      targetRecordType,
    },
    unitSystem
  );

  if (!result.success) {
    return {
      status: "error",
      error: result.error,
      values: echoFormValues(formData),
    };
  }

  const existing = await getGoalForUser(id, user.id);
  if (!existing) {
    throw new Error("Goal not found.");
  }

  // targetCustomName is compared case-insensitively, not with `!==` like
  // the other four fields, because it's the one field whose "canonical"
  // spelling can legitimately drift out from under an untouched goal:
  // resolveCanonicalCustomName (lib/personal-records.ts) always resolves a
  // submitted name to the earliest-recorded personal_records row that
  // matches case-insensitively, and that earliest row can change between
  // this goal's last save and now (a differently-cased record added or
  // removed elsewhere). subjectKey (lib/personal-records-grouping.ts) already treats
  // "5k" and "5K" as one subject for grouping/matching current values — an
  // exact string comparison here would disagree with that identity and
  // flag a same-subject goal as changed purely because the on-file spelling
  // was re-cased, discarding a real start_value over a cosmetic difference.
  const targetSubjectChanged =
    existing.goalType !== result.data.goalType ||
    existing.targetMetricType !== result.data.targetMetricType ||
    existing.targetExerciseId !== result.data.targetExerciseId ||
    (existing.targetCustomName?.toLowerCase() ?? null) !==
      (result.data.targetCustomName?.toLowerCase() ?? null) ||
    existing.targetRecordType !== result.data.targetRecordType;

  // Whether checkGoalNotAlreadyMet needs to re-run at all — see the doc
  // comment above for why this is broader than, and built on top of,
  // targetSubjectChanged rather than a second field-by-field comparison.
  const alreadyMetInputsChanged =
    targetSubjectChanged ||
    existing.direction !== result.data.direction ||
    existing.targetValue !== result.data.targetValue ||
    existing.period !== result.data.period;

  let resolvedCurrent: number | null = null;
  if (alreadyMetInputsChanged) {
    const checked = await checkGoalNotAlreadyMet(
      result.data,
      result.data.direction,
      result.data.targetValue,
      user.id,
      today,
      timezone,
      unitSystem,
      isHyroxStation
    );
    if (!checked.ok) {
      return {
        status: "error",
        error: checked.error,
        values: echoFormValues(formData),
      };
    }
    resolvedCurrent = checked.current;
  }

  let startValue: number | null;
  if (result.data.direction === "decrease") {
    // Narrower than alreadyMetInputsChanged on purpose — see the doc
    // comment above. True here always implies alreadyMetInputsChanged was
    // also true, so resolvedCurrent already holds the freshly resolved
    // value and checkGoalNotAlreadyMet doesn't need a second call.
    //
    // Fires only when this specific edit's submitted direction is
    // "decrease" while the row's direction *before this edit* was
    // something else (necessarily "increase" — those are the only two
    // values). An increase goal never has a start_value (see the final
    // `else` below), so there is nothing to preserve: recapturing from
    // resolvedCurrent here is capturing one for the first time, not
    // discarding a real anchor. This is intentional, not the accidental
    // recapture a same-direction, same-subject edit would be — see
    // targetSubjectChanged above for that guard.
    const becameDecrease = existing.direction !== "decrease";
    startValue =
      targetSubjectChanged || becameDecrease
        ? resolvedCurrent
        : existing.startValue;
  } else {
    startValue = null;
  }

  const updated = await updateGoalForUser(id, user.id, {
    ...result.data,
    startValue,
  });
  if (!updated) {
    throw new Error("Goal not found.");
  }

  revalidatePath("/profile");
  return { status: "success" };
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
