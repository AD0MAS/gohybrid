"use client";

import { useActionState, useId, useState } from "react";
import { Pencil } from "lucide-react";
import {
  bodyMetricTypeEnum,
  goalDirectionEnum,
  goalPeriodEnum,
  goalTypeEnum,
  personalRecordTypeEnum,
  unitSystemEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import {
  FormErrorMessage,
  FormPendingBanner,
  FormSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import { groupExercisesForSelect, type GroupableExercise } from "@/lib/exercise-groups";
import type { Goal } from "@/lib/goals";
import {
  BODY_FAT_DIGIT_LIMIT,
  BODY_WEIGHT_DIGIT_LIMIT,
  CALORIES_DIGIT_LIMIT,
  DISTANCE_DIGIT_LIMIT,
  type DigitLimit,
  GOAL_COUNT_DIGIT_LIMIT,
  LIFTED_WEIGHT_DIGIT_LIMIT,
  REPS_DIGIT_LIMIT,
  RESTING_HR_DIGIT_LIMIT,
} from "@/lib/numeric-limits";
import { NAME_MAX_LENGTH } from "@/lib/text-limits";
import {
  convertDistanceInputToMetres,
  DISTANCE_INPUT_UNITS,
  formatBodyMetricValue,
  formatPersonalRecordValue,
  type DistanceInputUnit,
} from "@/lib/units";
import { isOneOf } from "@/lib/workouts-validation";
import DistanceInput from "../_components/DistanceInput";
import DurationInput from "../_components/DurationInput";
import Modal from "../_components/Modal";
import NumberField from "../_components/NumberField";
import { BODY_METRIC_LABELS } from "./body-metric-labels";
import { MENU_ITEM_CLASSES } from "../_components/CardMenu";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import { formatGoalValue, GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS } from "./goal-labels";
import { addGoal, updateGoal, type GoalFormState } from "./goals-actions";

type CatalogExercise = GroupableExercise;

type GoalFieldsProps = {
  catalog: CatalogExercise[];
  /** This user's distinct past custom_name values (getDistinctCustomNamesForUser,
   * lib/personal-records.ts), offered as a "Previously used" group in the
   * personal_record target-exercise <select> below — mirrors
   * PersonalRecordFields' own use of the same data. */
  customNames: string[];
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  /** Absent renders the Add-goal button + form; present renders a Pencil
   * edit trigger + the same form pre-filled from this goal, submitting to
   * updateGoal instead of addGoal. See the file-level doc comment below for
   * how the two modes share every field. */
  entry?: Goal;
  /** Only meaningful when `entry` is present: "menu-item" renders "Edit" as
   * a plain full-width text button (CardMenu's MENU_ITEM_CLASSES)
   * instead of the default bordered Pencil icon button — GoalsList's card
   * menu passes this. A plain string tag rather than a renderTrigger
   * callback (an earlier version of this prop): GoalsList, which composes
   * this trigger, is a Server Component, and a function can never cross
   * from a Server Component into a Client Component like this one — only
   * serializable values (strings, numbers, booleans, plain objects, and
   * JSX) survive that boundary. A closure-based renderTrigger stays valid
   * only for a client-to-client caller, same as EventForm's own (see its
   * doc comment) — GoalFields has no such caller today. */
  triggerVariant?: "icon" | "menu-item";
  /** Only meaningful when `entry` is absent: overrides the Add-goal button's
   * label, e.g. "Set your first goal" for GoalsList's hero empty state
   * versus "Add goal" for the page header's own copy of this same button. */
  addLabel?: string;
  /** Only meaningful when `entry` is absent: hides the Add-goal trigger
   * button itself via `hidden` (display: none) without unmounting this
   * component — GoalsList's hero instance passes this once a goal exists,
   * instead of GoalsList conditionally rendering (and thereby destroying)
   * the instance itself. See GoalsList's own doc comment for why: this
   * component's `successCount`/FormSuccessBanner state must survive the
   * exact render that flips the section from empty to non-empty, since
   * that's the one save whose own success would otherwise be discarded by
   * unmounting the very instance that just recorded it. */
  hidden?: boolean;
};

const initialState: GoalFormState = { status: "idle" };

/** Same value-encoding scheme as PersonalRecordFields' own
 * EXISTING_CUSTOM_PREFIX — see that file's comment. */
const EXISTING_CUSTOM_PREFIX = "existing:";

// session_count and streak goals are always "increase" (validateGoalInput
// rejects "decrease" for either — fewer sessions or a shorter streak is
// never the target). Only these two goal_types get a direction choice.
const DIRECTION_CHOICE_TYPES = new Set<
  (typeof goalTypeEnum.enumValues)[number]
>(["body_metric", "personal_record"]);

/**
 * The Add/Edit trigger plus the Modal shell: owns `open`, the
 * useActionState pair, and `formKey` — everything that must survive across
 * the modal opening and closing, since this component itself is never
 * unmounted (Modal always keeps its children mounted and only toggles the
 * native <dialog> via open/close — see Modal's own doc comment). The actual
 * fields live in GoalFormFields below, mounted fresh on every open (see
 * openFresh) so a reopen can never show whatever goalType/subject/value was
 * last selected and abandoned rather than `entry` as stored.
 *
 * This split exists because a failed submit's `formKey` bump alone (the
 * original mechanism) only remounts the <form> DOM node — enough to fix
 * plain uncontrolled fields (their defaultValue is just re-read), but not
 * goalType/direction/the exercise-or-custom-name selection/targetMetricType/
 * targetRecordType, all *controlled*: a controlled element's displayed
 * value comes from a useState in whichever component owns it, and
 * remounting a <form> one level below that component does nothing to reset
 * it. Moving that state into its own component and keying *that* component
 * on `formKey` is what actually resets it: a full remount re-runs every one
 * of GoalFormFields' useState initializers from `entry` again, with no
 * field left out — the alternative, resetting each piece of state by hand
 * on open, would need every one listed and would silently miss any added
 * later.
 *
 * `open` is local state, closed only once addGoal's state actually reaches
 * "success" — an error leaves it open so the user can fix and resubmit
 * without retyping. That close is done during render (comparing the state
 * object's identity against prevState), not in a useEffect, since setState
 * in an effect just to react to another piece of React state is the
 * pattern React's own docs steer away from in favour of adjusting state
 * directly while rendering. The comparison uses `state !== prevState` —
 * object identity, not `state.status !== prevStatus` — because addGoal
 * returns a fresh object literal on every call: comparing only the
 * `.status` string would miss two consecutive identical statuses (e.g. a
 * second successful submission right after the first), since "success" ===
 * "success" leaves the check unable to tell "still the old result" from "a
 * new result that happens to match."
 *
 * `errorActive` answers a question `state`'s own identity can't: whether
 * the error it's currently holding (if any) still belongs to the session
 * that's open right now, or is left over from one the user dismissed
 * without fixing (Esc, the X, a backdrop click — none of those reset
 * `state`, since none of them submit the form). Without it, reopening after
 * an abandoned error would still compute `submitted` from that stale
 * `state.status === "error"` and hand GoalFormFields the abandoned
 * attempt's echoed values instead of `entry`'s — the exact bug this whole
 * change fixes, just reached through the error path instead of the
 * type-switch-then-close one. `visibleState` is what GoalFormFields
 * actually receives as `state`: the real error while `errorActive`, and
 * `initialState` otherwise, so it never has to know any of this itself.
 *
 * When `entry` is present, this same component renders as GoalsList's
 * per-row edit trigger instead of the page header's Add button: a Pencil
 * icon-button by default, or a plain "Edit" menu-item button when
 * `triggerVariant="menu-item"` (GoalsList's card menu passes this). "Edit
 * goal"/"Save" copy either way. `updateGoal.bind(null, entry.id)` is used
 * as the form action in place of addGoal — the bound function still
 * matches useActionState's (prevState, formData) signature.
 */
export default function GoalFields({
  catalog,
  customNames,
  unitSystem,
  entry,
  triggerVariant = "icon",
  addLabel = "Add goal",
  hidden = false,
}: GoalFieldsProps) {
  const [open, setOpen] = useState(false);
  const action = entry ? updateGoal.bind(null, entry.id) : addGoal;
  const [state, formAction] = useActionState(action, initialState);
  const [prevState, setPrevState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  const [errorActive, setErrorActive] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setOpen(false);
      setSuccessCount((count) => count + 1);
    } else if (state.status === "error") {
      setFormKey((key) => key + 1);
      setErrorActive(true);
    }
  }
  const visibleState: GoalFormState = errorActive ? state : initialState;

  function openFresh() {
    setFormKey((key) => key + 1);
    setErrorActive(false);
    setOpen(true);
  }

  return (
    <>
      <FormSuccessBanner trigger={successCount} label="Saved" />
      {entry ? (
        triggerVariant === "menu-item" ? (
          <button type="button" onClick={openFresh} className={MENU_ITEM_CLASSES}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={openFresh}
            aria-label="Edit"
            className="flex h-8 w-8 items-center justify-center rounded-small border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      ) : (
        // The `hidden` HTML attribute alone wouldn't do this: it's a
        // user-agent-origin rule, and an unconditional `flex` class is
        // author-origin — author beats user-agent regardless of order or
        // specificity, the same cascade fact that once broke Modal's own
        // <dialog> (see its doc comment). Swapping the whole className
        // instead means "flex" is never present on the same element as the
        // thing trying to override it.
        <button
          type="button"
          onClick={openFresh}
          className={
            hidden
              ? "hidden"
              : "flex h-11 w-full items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto"
          }
        >
          {addLabel}
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={entry ? "Edit goal" : "Add goal"}
        description="Pick what to measure, then a target and a window."
      >
        <GoalFormFields
          key={formKey}
          catalog={catalog}
          customNames={customNames}
          unitSystem={unitSystem}
          entry={entry}
          state={visibleState}
          formAction={formAction}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

/** Re-derives the personal_record target <select>'s own encoded value (same
 * value space as PersonalRecordFields' own subject <select> — see its
 * matching helper's doc comment) for a fresh mount: from `submitted`'s
 * echoed targetExerciseId/targetCustomName while an error is still live for
 * this session, otherwise from `entry`. Both sources go through the same
 * exerciseId-then-customName resolution — `entry` used to short-circuit on
 * `entry?.targetExerciseId ?? ""` alone, which returned "" (Custom (new)…)
 * for any entry targeting a custom name instead of an exercise, since such
 * an entry's targetExerciseId is null. That desynced the dropdown from the
 * goal being edited (it opened on "Custom (new)…" instead of highlighting
 * the existing name under "Previously used") even though the plain text
 * input next to it still defaulted correctly from entry.targetCustomName —
 * so a genuinely unmodified Save still round-tripped the same value and
 * this never corrupted data, but the control itself lied about what was
 * selected. */
function deriveSubjectSelection(
  submitted: Record<string, string> | null,
  entry: Goal | undefined,
  catalog: CatalogExercise[],
  customNames: string[]
): string {
  const exerciseId = submitted ? submitted.targetExerciseId : entry?.targetExerciseId;
  if (exerciseId && catalog.some((exercise) => exercise.id === exerciseId)) {
    return exerciseId;
  }
  const customName = submitted ? submitted.targetCustomName : entry?.targetCustomName;
  if (customName) {
    const match = customNames.find((name) => name === customName);
    return match ? `${EXISTING_CUSTOM_PREFIX}${match}` : "";
  }
  return "";
}

type GoalFormFieldsProps = {
  catalog: CatalogExercise[];
  customNames: string[];
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  entry?: Goal;
  state: GoalFormState;
  formAction: (formData: FormData) => void;
  /** Closes the modal without submitting — the Cancel button's handler.
   * Distinct from the dialog's own X/Esc/backdrop close (still wired via
   * Modal's onClose): a modal is a draft, so both paths discard the same
   * way, but Cancel is an explicit in-form control the design calls for
   * alongside the destructive-vs-safe button pairing every other form in
   * the app already uses (Cancel/Save, Cancel/Delete). */
  onCancel: () => void;
};

/**
 * The form's actual fields, split out from GoalFields (see its doc comment)
 * so the parent can mount a fresh instance of this component — keyed on
 * `formKey` — on every open, not just on a failed submit. Needed for the
 * goal-type-driven field visibility: only the target_* fields relevant to
 * the selected goalType ever render, so the common case can't be gotten
 * wrong — validateGoalInput is still the actual gate server-side. The
 * direction select itself only renders for body_metric/personal_record
 * goals; session_count/streak submit a fixed hidden direction="increase"
 * instead, since the server rejects any other value for them. There is no
 * startValue field anywhere in this form — a decrease goal's starting value
 * is never typed, it's captured server-side from the goal's own data
 * source at creation/re-target time (see addGoal/updateGoal in
 * goals-actions.ts and resolveCurrentValueForTarget in lib/goals.ts).
 * Switching goalType away from body_metric/personal_record resets direction
 * back to "increase" so a "decrease" chosen earlier can't linger into a
 * goal_type that forbids it. Mirrors PersonalRecordFields' single-select
 * exercise/custom-name choice for personal_record goals.
 *
 * targetValue's placeholder shows the unit the user is expected to type —
 * same resolution PersonalRecordFields uses for its own value input
 * (formatBodyMetricValue/formatPersonalRecordValue from lib/units.ts, for
 * every target except a distance personal_record, which renders
 * DistanceInput's own unit <select> instead of a placeholder).
 *
 * `state` arrives already resolved by the parent to whatever should
 * genuinely be visible this mount (see GoalFields' `visibleState`) — every
 * read of `state`/`submitted` below stays exactly the shape it always was,
 * this component just doesn't have to know why. Every controlled field's
 * initializer (goalType, direction, subjectSelection,
 * targetMetricType/targetRecordType) prefers `submitted` over `entry`'s own
 * values: while `state` is a live error (this component was just remounted
 * because a submission failed, not because the modal was freshly reopened),
 * `submitted` holds what the user actually just tried to submit, and that
 * must win over `entry`'s original value — the whole point of a failed
 * submit remounting this component at all is to restore what was typed.
 *
 * A remount alone is sufficient for those controlled fields — they live in
 * this component's own useState and are re-initialized fresh on every
 * mount. It's NOT sufficient for the plain uncontrolled fields (title,
 * targetCustomName, targetPrimaryType, period, targetValue, and
 * DurationInput's own internal boxes state) — nothing in this component
 * remembers what the user typed into those beyond its initial render, so
 * those need the actual submitted strings echoed back via `fieldDefault`,
 * reading from `submitted`, in preference to `entry`/the add-time default.
 * DurationInput's hidden input already submits its composed value in whole
 * seconds under the field's own name, so the echoed string needs no
 * reparsing to become `defaultValueSeconds`. DistanceInput submits two
 * hidden inputs (`targetValue` and `targetValueUnit` — see its own doc
 * comment), so `fieldDefaultDistanceMetres`/`fieldDefaultDistanceUnit`
 * below read both and re-derive metres via convertDistanceInputToMetres,
 * pinning the exact unit the user had selected via DistanceInput's
 * `defaultUnit` rather than letting it re-guess one from the recovered
 * metres value.
 */
function GoalFormFields({
  catalog,
  customNames,
  unitSystem,
  entry,
  state,
  formAction,
  onCancel,
}: GoalFormFieldsProps) {
  const uid = useId();
  const submitted = state.status === "error" ? state.values : null;
  function fieldDefault(name: string, fallback?: string): string | undefined {
    return submitted?.[name] ?? fallback;
  }
  // DurationInput submits its composed value in whole seconds under the
  // field's own name — the echoed string is already what
  // defaultValueSeconds expects, no reparsing needed.
  function fieldDefaultSeconds(name: string, fallback: number | null): number | null {
    if (submitted && name in submitted) {
      const raw = submitted[name];
      return raw === "" ? null : Number(raw);
    }
    return fallback;
  }
  // DistanceInput's defaultValueMetres/defaultUnit counterparts — see the
  // file-level doc comment's final paragraph for why the unit must be
  // restored exactly, not re-derived from the recovered metres value.
  function fieldDefaultDistanceMetres(
    name: string,
    fallback: number | null
  ): number | null {
    if (submitted && name in submitted) {
      const raw = submitted[name];
      const unit = submitted[`${name}Unit`];
      if (raw === "" || !isOneOf(unit, DISTANCE_INPUT_UNITS)) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed)
        ? convertDistanceInputToMetres(parsed, unit)
        : null;
    }
    return fallback;
  }
  function fieldDefaultDistanceUnit(name: string): DistanceInputUnit | undefined {
    const unit = submitted?.[`${name}Unit`];
    return isOneOf(unit, DISTANCE_INPUT_UNITS) ? unit : undefined;
  }
  const [goalType, setGoalType] =
    useState<(typeof goalTypeEnum.enumValues)[number]>(() =>
      isOneOf(submitted?.goalType, goalTypeEnum.enumValues)
        ? submitted.goalType
        : entry?.goalType ?? "session_count"
    );
  const [direction, setDirection] =
    useState<(typeof goalDirectionEnum.enumValues)[number]>(() =>
      isOneOf(submitted?.direction, goalDirectionEnum.enumValues)
        ? submitted.direction
        : entry?.direction ?? "increase"
    );
  // Same subjectSelection/exerciseId/existingCustomName/isNewCustomName
  // scheme as PersonalRecordFields — see its own comments for why this is
  // one piece of state rather than two.
  const [subjectSelection, setSubjectSelection] = useState(() =>
    deriveSubjectSelection(submitted, entry, catalog, customNames)
  );
  const exerciseId = catalog.some((exercise) => exercise.id === subjectSelection)
    ? subjectSelection
    : null;
  const existingCustomName = subjectSelection.startsWith(EXISTING_CUSTOM_PREFIX)
    ? subjectSelection.slice(EXISTING_CUSTOM_PREFIX.length)
    : null;
  const isNewCustomName = exerciseId === null && existingCustomName === null;
  const [targetMetricType, setTargetMetricType] =
    useState<(typeof bodyMetricTypeEnum.enumValues)[number]>(() =>
      isOneOf(submitted?.targetMetricType, bodyMetricTypeEnum.enumValues)
        ? submitted.targetMetricType
        : entry?.targetMetricType ?? bodyMetricTypeEnum.enumValues[0]
    );
  const [targetRecordType, setTargetRecordType] =
    useState<(typeof personalRecordTypeEnum.enumValues)[number]>(() =>
      isOneOf(submitted?.targetRecordType, personalRecordTypeEnum.enumValues)
        ? submitted.targetRecordType
        : entry?.targetRecordType ?? personalRecordTypeEnum.enumValues[0]
    );

  const isHyroxStation =
    catalog.find((exercise) => exercise.id === exerciseId)?.isHyroxStation ??
    false;
  const entryIsDistanceRecord =
    entry?.goalType === "personal_record" && entry.targetRecordType === "distance";

  // Only pre-fills while the currently selected goalType (and, for
  // body_metric/personal_record, the currently selected subject type) still
  // matches entry's own stored subject — switching goalType or its subject
  // type must not hand the new type's input a value that was recorded (and
  // means something different) under the old one. Same reasoning as
  // PersonalRecordFields' defaultValue.
  const entryTypeMatches =
    entry?.goalType === goalType &&
    (goalType !== "body_metric" || entry?.targetMetricType === targetMetricType) &&
    (goalType !== "personal_record" || entry?.targetRecordType === targetRecordType);

  const defaultTargetValue =
    entry && entryTypeMatches && !entryIsDistanceRecord
      ? formatGoalValue(entry, entry.targetValue, unitSystem).value
      : undefined;

  const showDirectionChoice = DIRECTION_CHOICE_TYPES.has(goalType);
  const isTimeRecordGoal =
    goalType === "personal_record" && targetRecordType === "time";
  const isDistanceRecordGoal =
    goalType === "personal_record" && targetRecordType === "distance";

  // What targetValue actually means — a session/streak count, one of three
  // body-metric units, or one of five record-type units — changes with
  // goalType and (for the two goal_types with a subject) the subject's own
  // type selector. Keying the value input on this, below, forces a fresh
  // uncontrolled input whenever that meaning changes, so a number typed
  // under one meaning can't linger and get reinterpreted under another
  // (e.g. a "time" PR goal's composed seconds redisplayed as "weight").
  const valueKind =
    goalType === "body_metric"
      ? `body_metric-${targetMetricType}`
      : goalType === "personal_record"
        ? `personal_record-${targetRecordType}`
        : goalType;

  function handleGoalTypeChange(
    value: (typeof goalTypeEnum.enumValues)[number]
  ) {
    setGoalType(value);
    if (!DIRECTION_CHOICE_TYPES.has(value)) {
      setDirection("increase");
    }
  }

  let valueUnit: string;
  let valueStep: number | "any";
  let valueMin: number;
  let valueDigitLimit: DigitLimit;
  switch (goalType) {
    case "session_count":
      valueUnit = "sessions";
      valueStep = 1;
      // A target of 0 sessions isn't a goal.
      valueMin = 1;
      valueDigitLimit = GOAL_COUNT_DIGIT_LIMIT;
      break;
    case "streak":
      valueUnit = "days";
      valueStep = 1;
      // A target of 0 days isn't a goal either.
      valueMin = 1;
      valueDigitLimit = GOAL_COUNT_DIGIT_LIMIT;
      break;
    case "body_metric":
      valueUnit = formatBodyMetricValue(targetMetricType, 0, unitSystem).unit;
      // "any" for weight/body_fat — both allow any 0.1 (BODY_WEIGHT_DIGIT_
      // LIMIT/BODY_FAT_DIGIT_LIMIT's maxDecimals: 1), and step 0.1 made the
      // spinner arrows crawl one-tenth at a time. Resting HR stays a whole
      // number at step 1.
      valueStep = targetMetricType === "resting_hr" ? 1 : "any";
      // min: 1 for all three, mirrors BodyMetricFields exactly — these are
      // the same physical quantities (a body weight/body fat %/resting
      // heart rate), just targeted rather than logged, and a target of 0
      // is exactly as meaningless either way.
      valueMin = 1;
      valueDigitLimit =
        targetMetricType === "weight"
          ? BODY_WEIGHT_DIGIT_LIMIT
          : targetMetricType === "body_fat"
            ? BODY_FAT_DIGIT_LIMIT
            : RESTING_HR_DIGIT_LIMIT;
      break;
    case "personal_record": {
      // Unused when targetRecordType is "distance" — that case renders
      // DistanceInput's own unit <select> instead of this placeholder.
      valueUnit = formatPersonalRecordValue(
        targetRecordType,
        0,
        unitSystem,
        isHyroxStation
      ).unit;
      // "any" for weight — LIFTED_WEIGHT_DIGIT_LIMIT allows any 0.1, and
      // step 2.5 rejected a typed 82.5's own neighbours. Calories/reps are
      // whole-number counts, so step 1 (not "any") is both correct and
      // sufficient for them; step 10 previously made the browser reject a
      // typed value like 25 as invalid ("nearest valid values are 20 and
      // 30") — never intentional, calories aren't multiples of 10.
      valueStep = targetRecordType === "weight" ? "any" : 1;
      // Mirrors PersonalRecordFields' own valueMin exactly, including
      // keeping weight at 0: raising it reproduces the spinner-arrow bug
      // (arrows counting up from the min instead of whole numbers), and
      // there's no 0-to-null correction to lean on here either — a
      // personal_record goal's target is required, with no "blank means
      // bodyweight" reading, so a typed 0 is a genuine error. It's
      // rejected by validateGoalInput's own "must be greater than 0"
      // message instead (lib/goals-validation.ts). Reps/calories keep
      // min: 1.
      valueMin = targetRecordType === "weight" ? 0 : 1;
      valueDigitLimit =
        targetRecordType === "weight"
          ? LIFTED_WEIGHT_DIGIT_LIMIT
          : targetRecordType === "calories"
            ? CALORIES_DIGIT_LIMIT
            : REPS_DIGIT_LIMIT;
      break;
    }
  }
  // Mirrors the switch above, as a boolean rather than a step size: only
  // a non-resting_hr body metric or a weight personal record ever takes a
  // decimal point here (session_count/streak/reps/calories are whole
  // numbers). Unused when targetRecordType is "time"/"distance" — those
  // render DurationInput/DistanceInput instead of this plain number input.
  const allowDecimalTargetValue =
    goalType === "body_metric"
      ? targetMetricType !== "resting_hr"
      : goalType === "personal_record" && targetRecordType === "weight";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-title`} className="text-xs font-medium text-ink-subtle">
          Title
        </label>
        <input
          type="text"
          id={`${uid}-title`}
          name="title"
          placeholder="Goal title"
          defaultValue={fieldDefault("title", entry?.title)}
          required
          maxLength={NAME_MAX_LENGTH}
          className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-goalType`} className="text-xs font-medium text-ink-subtle">
          Goal type
        </label>
        <select
          id={`${uid}-goalType`}
          name="goalType"
          value={goalType}
          onChange={(e) =>
            handleGoalTypeChange(
              e.target.value as (typeof goalTypeEnum.enumValues)[number]
            )
          }
          className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          {goalTypeEnum.enumValues.map((type) => (
            <option key={type} value={type}>
              {GOAL_TYPE_LABELS[type].label}
            </option>
          ))}
        </select>
      </div>

      {goalType === "session_count" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-targetPrimaryType`} className="text-xs font-medium text-ink-subtle">
            Workout type
          </label>
          <select
            id={`${uid}-targetPrimaryType`}
            name="targetPrimaryType"
            defaultValue={fieldDefault(
              "targetPrimaryType",
              entry?.targetPrimaryType ?? ""
            )}
            className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <option value="">Any type</option>
            {workoutPrimaryTypeEnum.enumValues.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      )}

      {goalType === "body_metric" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-targetMetricType`} className="text-xs font-medium text-ink-subtle">
            Metric type
          </label>
          <select
            id={`${uid}-targetMetricType`}
            name="targetMetricType"
            value={targetMetricType}
            onChange={(e) =>
              setTargetMetricType(
                e.target.value as (typeof bodyMetricTypeEnum.enumValues)[number]
              )
            }
            className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {bodyMetricTypeEnum.enumValues.map((type) => (
              <option key={type} value={type}>
                {BODY_METRIC_LABELS[type].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {goalType === "personal_record" && (
        <>
          {/* Not a form field itself — see PersonalRecordFields' matching
              <select> comment for the value-encoding scheme and why
              targetExerciseId/targetCustomName are submitted via the
              explicit inputs below instead. */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-subject`} className="text-xs font-medium text-ink-subtle">
              Exercise
            </label>
            <select
              id={`${uid}-subject`}
              value={subjectSelection}
              onChange={(e) => setSubjectSelection(e.target.value)}
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              <option value="">Custom (new)…</option>
              {customNames.length > 0 && (
                <optgroup label="Previously used">
                  {customNames.map((name) => (
                    <option
                      key={name}
                      value={`${EXISTING_CUSTOM_PREFIX}${name}`}
                    >
                      {name}
                    </option>
                  ))}
                </optgroup>
              )}
              {groupExercisesForSelect(catalog, { includeRest: false }).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <input
            type="hidden"
            name="targetExerciseId"
            value={exerciseId ?? ""}
          />

          {isNewCustomName && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-targetCustomName`} className="text-xs font-medium text-ink-subtle">
                Custom name
              </label>
              <input
                type="text"
                id={`${uid}-targetCustomName`}
                name="targetCustomName"
                placeholder="Custom name"
                defaultValue={fieldDefault(
                  "targetCustomName",
                  entry?.targetCustomName ?? ""
                )}
                maxLength={NAME_MAX_LENGTH}
                className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              />
            </div>
          )}
          {existingCustomName !== null && (
            <input
              type="hidden"
              name="targetCustomName"
              value={existingCustomName}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-targetRecordType`} className="text-xs font-medium text-ink-subtle">
              Record type
            </label>
            <select
              id={`${uid}-targetRecordType`}
              name="targetRecordType"
              value={targetRecordType}
              onChange={(e) =>
                setTargetRecordType(
                  e.target.value as (typeof personalRecordTypeEnum.enumValues)[number]
                )
              }
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              {personalRecordTypeEnum.enumValues.map((type) => (
                <option key={type} value={type}>
                  {PERSONAL_RECORD_LABELS[type].label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {showDirectionChoice ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-direction`} className="text-xs font-medium text-ink-subtle">
            Direction
          </label>
          <select
            id={`${uid}-direction`}
            name="direction"
            value={direction}
            onChange={(e) =>
              setDirection(
                e.target.value as (typeof goalDirectionEnum.enumValues)[number]
              )
            }
            className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {goalDirectionEnum.enumValues.map((value) => (
              <option key={value} value={value}>
                {value === "increase" ? "Increase" : "Decrease"}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="direction" value="increase" />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-period`} className="text-xs font-medium text-ink-subtle">
          Window
        </label>
        <select
          id={`${uid}-period`}
          name="period"
          defaultValue={fieldDefault("period", entry?.period ?? "week")}
          className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          {goalPeriodEnum.enumValues.map((period) => (
            <option key={period} value={period}>
              {GOAL_PERIOD_LABELS[period].label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        {isTimeRecordGoal || isDistanceRecordGoal ? (
          <span className="text-xs font-medium text-ink-subtle">Target</span>
        ) : (
          <label htmlFor={`${uid}-targetValue`} className="text-xs font-medium text-ink-subtle">
            Target
          </label>
        )}
        {isTimeRecordGoal ? (
          <DurationInput
            key={valueKind}
            maxUnit="hours"
            name="targetValue"
            surface="surface-2"
            defaultValueSeconds={fieldDefaultSeconds(
              "targetValue",
              defaultTargetValue ?? null
            )}
          />
        ) : isDistanceRecordGoal ? (
          <DistanceInput
            key={`${valueKind}-${isHyroxStation ? "hyrox" : "standard"}`}
            name="targetValue"
            unitSystem={unitSystem}
            isHyroxStation={isHyroxStation}
            digitLimit={DISTANCE_DIGIT_LIMIT}
            surface="surface-2"
            defaultValueMetres={fieldDefaultDistanceMetres(
              "targetValue",
              entry && entryIsDistanceRecord ? entry.targetValue : null
            )}
            defaultUnit={fieldDefaultDistanceUnit("targetValue")}
          />
        ) : (
          <NumberField
            key={valueKind}
            id={`${uid}-targetValue`}
            name="targetValue"
            step={valueStep}
            min={valueMin}
            required
            digitLimit={valueDigitLimit}
            allowDecimal={allowDecimalTargetValue}
            initialValue={fieldDefault(
              "targetValue",
              defaultTargetValue !== undefined
                ? String(defaultTargetValue)
                : undefined
            )}
            placeholder={`Target value (${valueUnit})`}
            className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        )}
      </div>

      <FormErrorMessage
        error={state.status === "error" ? state.error : null}
      />

      <div className="mt-1 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-base text-ink hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Cancel
        </button>
        <SubmitButton className="flex h-11 items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
          {entry ? "Save" : "Add goal"}
        </SubmitButton>
      </div>
      <FormPendingBanner label="Saving…" />
    </form>
  );
}
