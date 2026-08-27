"use client";

import { useActionState, useState } from "react";
import {
  bodyMetricTypeEnum,
  goalDirectionEnum,
  goalPeriodEnum,
  goalTypeEnum,
  personalRecordTypeEnum,
  unitSystemEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import { formatBodyMetricValue, formatPersonalRecordValue, resolveDistanceInputUnit } from "@/lib/units";
import { BODY_METRIC_LABELS } from "./body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import { GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS } from "./goal-labels";
import { addGoal, type GoalFormState } from "./goals-actions";

type GoalFieldsProps = {
  catalog: { id: string; name: string; isHyroxStation: boolean }[];
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
};

const initialState: GoalFormState = { error: null };

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
 */
export default function GoalFields({ catalog, unitSystem }: GoalFieldsProps) {
  const [state, formAction] = useActionState(addGoal, initialState);
  const [goalType, setGoalType] =
    useState<(typeof goalTypeEnum.enumValues)[number]>("session_count");
  const [direction, setDirection] =
    useState<(typeof goalDirectionEnum.enumValues)[number]>("increase");
  const [exerciseId, setExerciseId] = useState("");
  const [targetMetricType, setTargetMetricType] =
    useState<(typeof bodyMetricTypeEnum.enumValues)[number]>(
      bodyMetricTypeEnum.enumValues[0]
    );
  const [targetRecordType, setTargetRecordType] =
    useState<(typeof personalRecordTypeEnum.enumValues)[number]>(
      personalRecordTypeEnum.enumValues[0]
    );

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
      const isHyroxStation =
        catalog.find((exercise) => exercise.id === exerciseId)
          ?.isHyroxStation ?? false;
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
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="text"
        name="title"
        placeholder="Goal title"
        required
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      <select
        name="goalType"
        value={goalType}
        onChange={(e) =>
          handleGoalTypeChange(
            e.target.value as (typeof goalTypeEnum.enumValues)[number]
          )
        }
        className="h-11 rounded border border-gray-300 px-4 text-base"
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
          defaultValue=""
          className="h-11 rounded border border-gray-300 px-4 text-base"
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
          className="h-11 rounded border border-gray-300 px-4 text-base"
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
            className="h-11 rounded border border-gray-300 px-4 text-base"
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
              className="h-11 rounded border border-gray-300 px-4 text-base"
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
            className="h-11 rounded border border-gray-300 px-4 text-base"
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
          className="h-11 rounded border border-gray-300 px-4 text-base"
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
        defaultValue="week"
        className="h-11 rounded border border-gray-300 px-4 text-base"
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
          placeholder={`Starting value (${valueUnit})`}
          className="h-11 rounded border border-gray-300 px-4 text-base"
        />
      )}

      <input
        type="number"
        name="targetValue"
        step="0.01"
        min="0"
        required
        placeholder={`Target value (${valueUnit})`}
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button
        type="submit"
        className="flex h-11 items-center justify-center rounded bg-black px-4 text-base text-white"
      >
        Add goal
      </button>
    </form>
  );
}
