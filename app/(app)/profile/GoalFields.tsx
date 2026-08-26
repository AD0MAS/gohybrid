"use client";

import { useActionState, useState } from "react";
import {
  bodyMetricTypeEnum,
  goalDirectionEnum,
  goalPeriodEnum,
  goalTypeEnum,
  personalRecordTypeEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import { BODY_METRIC_LABELS } from "./body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import { GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS } from "./goal-labels";
import { addGoal, type GoalFormState } from "./goals-actions";

type GoalFieldsProps = {
  catalog: { id: string; name: string }[];
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
 */
export default function GoalFields({ catalog }: GoalFieldsProps) {
  const [state, formAction] = useActionState(addGoal, initialState);
  const [goalType, setGoalType] =
    useState<(typeof goalTypeEnum.enumValues)[number]>("session_count");
  const [direction, setDirection] =
    useState<(typeof goalDirectionEnum.enumValues)[number]>("increase");
  const [exerciseId, setExerciseId] = useState("");

  const showDirectionChoice = DIRECTION_CHOICE_TYPES.has(goalType);

  function handleGoalTypeChange(
    value: (typeof goalTypeEnum.enumValues)[number]
  ) {
    setGoalType(value);
    if (!DIRECTION_CHOICE_TYPES.has(value)) {
      setDirection("increase");
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="text"
        name="title"
        placeholder="Goal title"
        required
        className="rounded border border-gray-300 p-2 text-sm"
      />

      <select
        name="goalType"
        value={goalType}
        onChange={(e) =>
          handleGoalTypeChange(
            e.target.value as (typeof goalTypeEnum.enumValues)[number]
          )
        }
        className="rounded border border-gray-300 p-2 text-sm"
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
          className="rounded border border-gray-300 p-2 text-sm"
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
          defaultValue={bodyMetricTypeEnum.enumValues[0]}
          className="rounded border border-gray-300 p-2 text-sm"
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
            className="rounded border border-gray-300 p-2 text-sm"
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
              className="rounded border border-gray-300 p-2 text-sm"
            />
          )}

          <select
            name="targetRecordType"
            defaultValue={personalRecordTypeEnum.enumValues[0]}
            className="rounded border border-gray-300 p-2 text-sm"
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
          className="rounded border border-gray-300 p-2 text-sm"
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
        className="rounded border border-gray-300 p-2 text-sm"
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
          placeholder="Starting value"
          className="rounded border border-gray-300 p-2 text-sm"
        />
      )}

      <input
        type="number"
        name="targetValue"
        step="0.01"
        min="0"
        required
        placeholder="Target value"
        className="rounded border border-gray-300 p-2 text-sm"
      />

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button
        type="submit"
        className="rounded bg-black p-2 text-sm text-white"
      >
        Add goal
      </button>
    </form>
  );
}
