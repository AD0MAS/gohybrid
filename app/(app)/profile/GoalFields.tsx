"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  bodyMetricTypeEnum,
  goalDirectionEnum,
  goalPeriodEnum,
  goalTypeEnum,
  personalRecordTypeEnum,
  unitSystemEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import type { Goal } from "@/lib/goals";
import {
  formatBodyMetricValue,
  formatPersonalRecordValue,
  resolveDistanceInputUnit,
  toDistanceInputValue,
} from "@/lib/units";
import Modal from "../_components/Modal";
import { BODY_METRIC_LABELS } from "./body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import { formatGoalValue, GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS } from "./goal-labels";
import { addGoal, updateGoal, type GoalFormState } from "./goals-actions";

type GoalFieldsProps = {
  catalog: { id: string; name: string; isHyroxStation: boolean }[];
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  /** Absent renders the Add-goal button + form; present renders a Pencil
   * edit trigger + the same form pre-filled from this goal, submitting to
   * updateGoal instead of addGoal. See the file-level doc comment below for
   * how the two modes share every field. */
  entry?: Goal;
};

const initialState: GoalFormState = { status: "idle" };

// session_count and streak goals are always "increase" (validateGoalInput
// rejects "decrease" for either — fewer sessions or a shorter streak is
// never the target). Only these two goal_types get a direction choice.
const DIRECTION_CHOICE_TYPES = new Set<
  (typeof goalTypeEnum.enumValues)[number]
>(["body_metric", "personal_record"]);

/**
 * The whole add-goal form as a client component, needed for
 * useActionState plus the goal-type-driven field visibility: only the
 * target_* fields relevant to the selected goalType ever render, so the
 * common case can't be gotten wrong — validateGoalInput is still the
 * actual gate server-side. The direction select itself only renders for
 * body_metric/personal_record goals; session_count/streak submit a fixed
 * hidden direction="increase" instead, since the server rejects any other
 * value for them. direction === "decrease" additionally reveals the
 * startValue field — switching goalType away from body_metric/
 * personal_record resets direction back to "increase" so a "decrease"
 * chosen earlier can't linger into a goal_type that forbids it. Mirrors
 * PersonalRecordFields' single-select exercise/custom-name choice for
 * personal_record goals.
 *
 * targetValue/startValue's placeholders show the unit the user is
 * expected to type — same resolution PersonalRecordFields uses for its
 * own value input (formatBodyMetricValue/formatPersonalRecordValue/
 * resolveDistanceInputUnit from lib/units.ts), which is why
 * targetMetricType and targetRecordType need their own local state here
 * too (previously uncontrolled, since nothing else depended on their
 * current value). addGoal (goals-actions.ts) does the actual
 * imperial→metric conversion server-side — this component only ever
 * displays a unit, never converts a value.
 *
 * The form itself lives inside a Modal, opened by the button rendered
 * alongside it: `open` is local state, closed only once addGoal's state
 * actually reaches "success" — an error leaves it open so the user can
 * fix and resubmit without retyping. That close is done during render
 * (comparing the state object's identity against prevState), not in a
 * useEffect, since setState in an effect just to react to another piece
 * of React state is the pattern React's own docs steer away from in
 * favour of adjusting state directly while rendering. The comparison uses
 * `state !== prevState` — object identity, not `state.status !==
 * prevStatus` — because addGoal returns a fresh object literal on every
 * call: comparing only the `.status` string would miss two consecutive
 * identical statuses (e.g. a second successful submission right after the
 * first), since "success" === "success" leaves the check unable to tell
 * "still the old result" from "a new result that happens to match."
 *
 * When `entry` is present, this same component renders as GoalsList's
 * per-row edit trigger instead of the section's Add button: a Pencil
 * icon-button in place of the Plus button, "Edit goal"/"Save" copy, and
 * every field's local state seeded from `entry` instead of the create
 * defaults. `updateGoal.bind(null, entry.id)` is used as the form action
 * in place of addGoal — the bound function still matches useActionState's
 * (prevState, formData) signature. targetValue/startValue are seeded via
 * formatGoalValue (goal-labels.ts) for every goal_type except one: a
 * personal_record goal targeting "distance" must seed from
 * toDistanceInputValue instead (lib/units.ts), because formatGoalValue
 * delegates to formatPersonalRecordValue's DISPLAY unit (ft/mi, chosen per
 * value) while the input always reads back in the INPUT unit (always ft,
 * or m for a HYROX station — see resolveDistanceInputUnit). Seeding with
 * the display value under the input's unit label would silently corrupt
 * it on save. Every other goal_type has display and input agree (a weight
 * is always lb under imperial either way), so formatGoalValue is correct
 * for those.
 */
export default function GoalFields({ catalog, unitSystem, entry }: GoalFieldsProps) {
  const [open, setOpen] = useState(false);
  const action = entry ? updateGoal.bind(null, entry.id) : addGoal;
  const [state, formAction] = useActionState(action, initialState);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setOpen(false);
  }
  const [goalType, setGoalType] =
    useState<(typeof goalTypeEnum.enumValues)[number]>(
      entry?.goalType ?? "session_count"
    );
  const [direction, setDirection] =
    useState<(typeof goalDirectionEnum.enumValues)[number]>(
      entry?.direction ?? "increase"
    );
  const [exerciseId, setExerciseId] = useState(entry?.targetExerciseId ?? "");
  const [targetMetricType, setTargetMetricType] =
    useState<(typeof bodyMetricTypeEnum.enumValues)[number]>(
      entry?.targetMetricType ?? bodyMetricTypeEnum.enumValues[0]
    );
  const [targetRecordType, setTargetRecordType] =
    useState<(typeof personalRecordTypeEnum.enumValues)[number]>(
      entry?.targetRecordType ?? personalRecordTypeEnum.enumValues[0]
    );

  const isHyroxStation =
    catalog.find((exercise) => exercise.id === exerciseId)?.isHyroxStation ??
    false;
  const entryIsDistanceRecord =
    entry?.goalType === "personal_record" && entry.targetRecordType === "distance";

  const defaultTargetValue = entry
    ? entryIsDistanceRecord
      ? toDistanceInputValue(entry.targetValue, unitSystem, isHyroxStation)
      : formatGoalValue(entry, entry.targetValue, unitSystem).value
    : undefined;
  const defaultStartValue =
    entry?.startValue != null
      ? entryIsDistanceRecord
        ? toDistanceInputValue(entry.startValue, unitSystem, isHyroxStation)
        : formatGoalValue(entry, entry.startValue, unitSystem).value
      : undefined;

  const showDirectionChoice = DIRECTION_CHOICE_TYPES.has(goalType);

  function handleGoalTypeChange(
    value: (typeof goalTypeEnum.enumValues)[number]
  ) {
    setGoalType(value);
    if (!DIRECTION_CHOICE_TYPES.has(value)) {
      setDirection("increase");
    }
  }

  let valueUnit: string;
  switch (goalType) {
    case "session_count":
      valueUnit = "sessions";
      break;
    case "streak":
      valueUnit = "days";
      break;
    case "body_metric":
      valueUnit = formatBodyMetricValue(targetMetricType, 0, unitSystem).unit;
      break;
    case "personal_record": {
      valueUnit =
        targetRecordType === "distance"
          ? resolveDistanceInputUnit(unitSystem, isHyroxStation)
          : formatPersonalRecordValue(
              targetRecordType,
              0,
              unitSystem,
              isHyroxStation
            ).unit;
      break;
    }
  }

  return (
    <>
      {entry ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Plus className="h-4 w-4" />
          Add goal
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit goal" : "Add goal"}>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            type="text"
            name="title"
            placeholder="Goal title"
            defaultValue={entry?.title}
            required
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <select
            name="goalType"
            value={goalType}
            onChange={(e) =>
              handleGoalTypeChange(
                e.target.value as (typeof goalTypeEnum.enumValues)[number]
              )
            }
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {goalTypeEnum.enumValues.map((type) => (
              <option key={type} value={type}>
                {GOAL_TYPE_LABELS[type].label}
              </option>
            ))}
          </select>

          {goalType === "session_count" && (
            <select
              name="targetPrimaryType"
              defaultValue={entry?.targetPrimaryType ?? ""}
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              <option value="">Any type</option>
              {workoutPrimaryTypeEnum.enumValues.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          )}

          {goalType === "body_metric" && (
            <select
              name="targetMetricType"
              value={targetMetricType}
              onChange={(e) =>
                setTargetMetricType(
                  e.target.value as (typeof bodyMetricTypeEnum.enumValues)[number]
                )
              }
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              {bodyMetricTypeEnum.enumValues.map((type) => (
                <option key={type} value={type}>
                  {BODY_METRIC_LABELS[type].label}
                </option>
              ))}
            </select>
          )}

          {goalType === "personal_record" && (
            <>
              <select
                name="targetExerciseId"
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              >
                <option value="">Custom…</option>
                {catalog.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>

              {exerciseId === "" && (
                <input
                  type="text"
                  name="targetCustomName"
                  placeholder="Custom name"
                  defaultValue={entry?.targetCustomName ?? ""}
                  className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                />
              )}

              <select
                name="targetRecordType"
                value={targetRecordType}
                onChange={(e) =>
                  setTargetRecordType(
                    e.target.value as (typeof personalRecordTypeEnum.enumValues)[number]
                  )
                }
                className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              >
                {personalRecordTypeEnum.enumValues.map((type) => (
                  <option key={type} value={type}>
                    {PERSONAL_RECORD_LABELS[type].label}
                  </option>
                ))}
              </select>
            </>
          )}

          {showDirectionChoice ? (
            <select
              name="direction"
              value={direction}
              onChange={(e) =>
                setDirection(
                  e.target.value as (typeof goalDirectionEnum.enumValues)[number]
                )
              }
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              {goalDirectionEnum.enumValues.map((value) => (
                <option key={value} value={value}>
                  {value === "increase" ? "Increase" : "Decrease"}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="direction" value="increase" />
          )}

          <select
            name="period"
            defaultValue={entry?.period ?? "week"}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {goalPeriodEnum.enumValues.map((period) => (
              <option key={period} value={period}>
                {GOAL_PERIOD_LABELS[period].label}
              </option>
            ))}
          </select>

          {direction === "decrease" && (
            <input
              type="number"
              name="startValue"
              step="0.01"
              min="0"
              required
              defaultValue={defaultStartValue}
              placeholder={`Starting value (${valueUnit})`}
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          )}

          <input
            type="number"
            name="targetValue"
            step="0.01"
            min="0"
            required
            defaultValue={defaultTargetValue}
            placeholder={`Target value (${valueUnit})`}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          {state.status === "error" && (
            <p className="text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {entry ? "Save" : "Add goal"}
          </button>
        </form>
      </Modal>
    </>
  );
}
