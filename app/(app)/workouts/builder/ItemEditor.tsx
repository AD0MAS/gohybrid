import { useState, type Dispatch } from "react";
import { Pencil, StickyNote, X } from "lucide-react";
import type { unitSystemEnum } from "@/db/schema";
import {
  ITEM_CALORIES_DIGIT_LIMIT,
  ITEM_DISTANCE_DIGIT_LIMIT,
  ITEM_TARGET_RATE_DIGIT_LIMIT,
  LIFTED_WEIGHT_DIGIT_LIMIT,
  REPS_DIGIT_LIMIT,
} from "@/lib/numeric-limits";
import {
  formatDistanceMetres,
  formatDurationSeconds,
  formatWeightKg,
  secondsPerKmToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
} from "@/lib/units";
import DistanceInput from "../../_components/DistanceInput";
import DurationInput from "../../_components/DurationInput";
import Modal from "../../_components/Modal";
import ExercisePicker from "./ExercisePicker";
import type {
  BuilderAction,
  BuilderItem,
  CatalogExercise,
  TargetPreset,
  TargetType,
  VolumeType,
} from "./reducer";
import {
  numberInputGuardProps,
  sanitizeNumberInputChange,
} from "../../_components/sanitize-live-number";
import { TARGET_PRESET_LABELS } from "./target-preset-labels";
import { TARGET_TYPE_LABELS } from "./target-type-labels";
import { VOLUME_TYPE_LABELS } from "./volume-type-labels";

type ItemEditorProps = {
  blockId: string;
  item: BuilderItem;
  /** True only for the item just created by this render of ADD_ITEM (see
   * BlockEditor's own `lastAddedItemId`, scoped per block) — seeds `open`'s
   * initial value so the item's fields are presented the moment it's
   * added. Read once, at mount, not synced: reopening later via Configure
   * is entirely under the user's own control. Mirrors BlockEditor's own
   * `autoOpen` exactly. */
  autoOpen: boolean;
  catalog: readonly CatalogExercise[];
  volumeTypeOptions: readonly VolumeType[];
  /** Accepted (BlockEditor passes it through) but not destructured below —
   * the Target select's six modes are a fixed set the UI defines itself
   * (see TargetMode), not generated from this list. Still part of the type
   * so BlockEditor's own unchanged prop-drilling keeps typechecking. */
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  dispatch: Dispatch<BuilderAction>;
};

/**
 * The six mutually exclusive Target modes the builder's single Target
 * select offers, replacing the old separate preset/type/value controls.
 * "none" and "intensity_zone" don't correspond 1:1 to a TargetType enum
 * value (a preset, not a type); the other four line up with one TargetType
 * value each, except "pace", which covers both pace_500m and pace_km (see
 * PaceDisplayUnit below). Purely a UI grouping — never stored itself.
 * Initially seeded from item.targetPreset/targetType by deriveTargetMode,
 * then held as ItemEditor's own local state (see its doc comment there) —
 * "intensity_zone" with no preset chosen yet is indistinguishable from
 * "none" in stored data, so it can't be re-derived on every render.
 */
type TargetMode =
  | "none"
  | "intensity_zone"
  | "rpe"
  | "pace"
  | "cal_per_hour"
  | "watts";

/**
 * The unit the Pace mode's value box is currently shown in. Never stored —
 * local useState in ItemEditor, seeded from the saved item's target_type
 * and the unitSystem prop (see ItemEditor's own paceDisplayUnit
 * initializer). "500m" is target_type = pace_500m's only unit; "km"/"mi"
 * are both target_type = pace_km, converted for display via
 * secondsPerKmToSecondsPerMile — same canonical-value-plus-display-unit
 * split as DistanceInput's own unit select.
 */
type PaceDisplayUnit = "500m" | "km" | "mi";

/** Derives which of the six Target modes a *freshly loaded* item is in from
 * its stored fields — used only to seed ItemEditor's local targetMode state
 * once (see its doc comment), never called again afterwards. An item whose
 * targetPreset and targetType are both empty reads as "none" here, which is
 * correct for a genuinely untouched item; the "Intensity zone chosen, no
 * zone picked yet" case that also has both empty only exists as UI-session
 * state, never as something LOAD_WORKOUT could hand back. */
function deriveTargetMode(item: BuilderItem): TargetMode {
  if (item.targetPreset !== "") return "intensity_zone";
  if (item.targetType === "rpe") return "rpe";
  if (item.targetType === "pace_500m" || item.targetType === "pace_km") {
    return "pace";
  }
  if (item.targetType === "cal_per_hour") return "cal_per_hour";
  if (item.targetType === "watts") return "watts";
  return "none";
}

/** Converts a stored pace target_value (always seconds-per-500m for
 * pace_500m, always seconds-per-km for pace_km — see secondsPerKmToSecondsPerMile's
 * doc comment) into the seconds figure the currently selected display unit
 * should show. Read-side counterpart to paceValueFromDisplay below. */
function paceValueForDisplay(
  targetValue: number | null,
  unit: PaceDisplayUnit
): number | null {
  if (targetValue == null) return null;
  return unit === "mi" ? secondsPerKmToSecondsPerMile(targetValue) : targetValue;
}

/** Inverse of paceValueForDisplay — converts a seconds figure typed in the
 * currently selected display unit back into the canonical stored value. */
function paceValueFromDisplay(
  seconds: number | null,
  unit: PaceDisplayUnit
): number | null {
  if (seconds == null) return null;
  return unit === "mi" ? secondsPerMileToSecondsPerKm(seconds) : seconds;
}

/**
 * One-line rendering of what's configured on an item so far, in a fixed
 * order — sets × volume, target, weight, rest — joined the same way
 * formatBlockTiming (BlockEditor.tsx) joins block timing parts: each part
 * computed independently, filtered, then " · "-separated, so an unset part
 * is simply absent rather than leaving a stray separator. Notes are
 * deliberately not part of this string — see the StickyNote icon rendered
 * alongside it in ItemEditor's own JSX, which flags a note's presence
 * without showing its text (the note itself stays in the modal).
 *
 * Volume reads in the unit its volume_type implies — duration via
 * formatDurationSeconds, distance via formatDistanceMetres for the current
 * unit system, reps/calories as a plain count — and a volume_type set with
 * no value yet reads as "Open Ended", the same label the modal itself uses
 * for that state. Target reads as the preset's label (TARGET_PRESET_LABELS)
 * when a preset is set, or the target type's label (TARGET_TYPE_LABELS)
 * plus its value when a type is set instead — they're alternatives, same as
 * everywhere else this pair appears (see the reducer). Weight reads via
 * formatWeightKg. Rest reads via formatDurationSeconds, suffixed "rest" so
 * it isn't mistaken for another duration-shaped part.
 *
 * Returns null when nothing is configured yet, so the summary row can omit
 * the line entirely rather than render an empty one.
 */
function formatItemSummary(
  item: BuilderItem,
  unitSystem: (typeof unitSystemEnum.enumValues)[number],
  isHyroxStation: boolean
): string | null {
  const volume = (() => {
    if (item.volumeType === "") return null;
    if (item.volumeValue == null) return `${item.sets} × Open Ended`;
    if (item.volumeType === "duration") {
      return `${item.sets} × ${formatDurationSeconds(item.volumeValue)}`;
    }
    if (item.volumeType === "distance") {
      const distance = formatDistanceMetres(
        item.volumeValue,
        unitSystem,
        isHyroxStation
      );
      return `${item.sets} × ${distance.value} ${distance.unit}`;
    }
    const unitLabel = item.volumeType === "calories" ? "kcal" : "reps";
    return `${item.sets} × ${item.volumeValue} ${unitLabel}`;
  })();

  const target = (() => {
    if (item.targetPreset !== "") {
      return TARGET_PRESET_LABELS[item.targetPreset].label;
    }
    if (item.targetType === "pace_500m" || item.targetType === "pace_km") {
      if (item.targetValue == null) {
        return TARGET_TYPE_LABELS[item.targetType].label;
      }
      // Same "on opening" default as ItemEditor's own paceDisplayUnit
      // initializer: pace_500m always reads as /500m; pace_km reads as
      // /km for a metric user, /mi for an imperial one.
      const useMiles = item.targetType === "pace_km" && unitSystem === "imperial";
      const seconds = useMiles
        ? secondsPerKmToSecondsPerMile(item.targetValue)
        : item.targetValue;
      const unitLabel = item.targetType === "pace_500m" ? "/500m" : useMiles ? "/mi" : "/km";
      return `${formatDurationSeconds(seconds)} ${unitLabel}`;
    }
    if (item.targetType !== "") {
      const label = TARGET_TYPE_LABELS[item.targetType].label;
      return item.targetValue != null ? `${label} ${item.targetValue}` : label;
    }
    return null;
  })();

  const weight = (() => {
    if (item.weightKg == null) return null;
    const display = formatWeightKg(item.weightKg, unitSystem);
    return `${display.value} ${display.unit}`;
  })();

  const rest =
    item.restSeconds != null
      ? `${formatDurationSeconds(item.restSeconds)} rest`
      : null;

  const parts = [volume, target, weight, rest].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Editor for a single item within a block: a summary row (exercise/custom
 * name, then the compact line from formatItemSummary — sets × volume,
 * target, weight, rest — plus a StickyNote icon when notes are set) always
 * shown in the block's item list, plus a Configure control opening a Modal
 * with the full editor — exercise
 * selection (via ExercisePicker), then sets, volume, target, weight, rest,
 * and notes, all optional except sets, which defaults to 1. Leaving
 * volume_value empty with a volume_type selected means "Open Ended". A
 * distance volume_value renders DistanceInput in its controlled
 * (valueMetres + onChange) mode, same as DurationInput for a duration one —
 * item.volumeValue stays metres in builder state either way, so
 * createFullWorkout/updateFullWorkout need no unit awareness of their own.
 * `isHyroxStation` is looked up from `catalog` by the item's own
 * exerciseId, same pattern as PersonalRecordFields/GoalFields. target_type
 * + target_value and target_preset are alternatives: picking one clears the
 * other (enforced by the reducer).
 *
 * Changes dispatch immediately; there is no save/cancel inside the modal,
 * same as BlockEditor — every field is controlled straight off `item`
 * (reducer state) and dispatches straight back to it, so there's no local
 * state that could go stale between closing and reopening. The modal's
 * Done button, the last element inside its content (Modal itself has no
 * footer slot — see Modal's own doc comment), only calls setOpen(false),
 * same as the close X.
 *
 * `open`'s initial value comes from `autoOpen` (useState(autoOpen), not a
 * synced value) — see the `autoOpen` prop doc above.
 *
 * Not a "use client" file itself — see WorkoutBuilder for the single client
 * boundary.
 */
export default function ItemEditor({
  blockId,
  item,
  autoOpen,
  catalog,
  volumeTypeOptions,
  targetPresetOptions,
  unitSystem,
  dispatch,
}: ItemEditorProps) {
  const [open, setOpen] = useState(autoOpen);
  // Display-only, never stored — see PaceDisplayUnit's doc comment. Read
  // once at mount, same as `open` above: reopening later via Configure is
  // under the user's own control, not synced to prop changes.
  const [paceDisplayUnit, setPaceDisplayUnit] = useState<PaceDisplayUnit>(
    () => {
      if (item.targetType === "pace_500m") return "500m";
      return unitSystem === "imperial" ? "mi" : "km";
    }
  );
  const exercise = catalog.find(
    (candidate) => candidate.id === item.exerciseId
  );
  const isHyroxStation = exercise?.isHyroxStation ?? false;
  const itemName = exercise?.name || item.customName || "New item";
  const summary = formatItemSummary(item, unitSystem, isHyroxStation);
  const hasNotes = item.notes.trim() !== "";
  /**
   * Which section the Target select shows. Seeded once from item state via
   * deriveTargetMode (same "read once at mount" pattern as `open` and
   * `paceDisplayUnit` above), not re-derived on every render — because
   * "Intensity zone selected, no zone chosen yet" and "None" are now the
   * *same* stored state (targetPreset/targetType both empty; see the
   * Intensity zone sub-select's placeholder option below), so item state
   * alone can no longer tell them apart. Local state is what remembers
   * which of the two the user actually picked. Every branch of
   * handleTargetModeChange below keeps this in sync with whatever it
   * dispatches, the same way setPaceDisplayUnit does.
   */
  const [targetMode, setTargetMode] = useState<TargetMode>(() =>
    deriveTargetMode(item)
  );

  /**
   * Switches Target mode. "none" and "intensity_zone" dispatch the exact
   * same action — clear targetPreset — since entering Intensity zone no
   * longer eagerly picks a preset (see the sub-select's placeholder
   * option); only the local `targetMode` state (set above, unconditionally)
   * tells the two apart afterwards. The other four modes dispatch
   * targetType, relying on the reducer's own targetPreset/targetType
   * exclusivity (reducer.ts) to clear whatever the previous mode owned —
   * no new reducer logic needed either way.
   */
  function handleTargetModeChange(mode: TargetMode) {
    setTargetMode(mode);
    if (mode === "none" || mode === "intensity_zone") {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "targetPreset",
        value: "",
      });
      return;
    }
    const targetType: TargetType =
      mode === "pace"
        ? paceDisplayUnit === "500m"
          ? "pace_500m"
          : "pace_km"
        : mode;
    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId: item.id,
      field: "targetType",
      value: targetType,
    });
  }

  /**
   * Switches the Pace value box's display unit. Crossing between the
   * "500m" group and the "km"/"mi" group is a real target_type change
   * (pace_500m and pace_km are not interconvertible — see
   * secondsPerKmToSecondsPerMile's doc comment), so that dispatches and the
   * reducer clears the stored value. Switching between "km" and "mi" is a
   * pure display change: both read/write the same canonical
   * seconds-per-km value, so nothing is dispatched — only local state
   * changes, and the DurationInput below (keyed on paceDisplayUnit) remounts
   * to re-seed itself from the newly converted display value.
   */
  function handlePaceUnitChange(unit: PaceDisplayUnit) {
    const targetType: TargetType = unit === "500m" ? "pace_500m" : "pace_km";
    if (targetType !== item.targetType) {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "targetType",
        value: targetType,
      });
    }
    setPaceDisplayUnit(unit);
  }

  function handlePaceValueChange(seconds: number | null) {
    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId: item.id,
      field: "targetValue",
      value: paceValueFromDisplay(seconds, paceDisplayUnit),
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-surface-1 p-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{itemName}</p>
        {(summary || hasNotes) && (
          <p className="flex items-center gap-1.5 text-sm text-ink-subtle">
            {summary}
            {hasNotes && (
              <StickyNote
                className="h-3.5 w-3.5 shrink-0"
                aria-label="Has notes"
              />
            )}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Configure"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({ type: "REMOVE_ITEM", blockId, itemId: item.id })
          }
          aria-label="Remove item"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={itemName}>
        <div className="flex flex-col gap-3">
          <ExercisePicker
            blockId={blockId}
            itemId={item.id}
            exerciseId={item.exerciseId}
            customName={item.customName}
            catalog={catalog}
            dispatch={dispatch}
          />

          <label className="flex flex-col gap-1 text-sm">
            Sets
            <input
              type="number"
              min={1}
              step={1}
              required
              value={item.sets}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_ITEM_FIELD",
                  blockId,
                  itemId: item.id,
                  field: "sets",
                  // No dedicated Sets constant in lib/numeric-limits.ts —
                  // it's a plain whole-number count with the same shape as
                  // REPS_DIGIT_LIMIT (4 digits, no decimals), reused here
                  // rather than inventing a near-duplicate constant.
                  value:
                    sanitizeNumberInputChange(e, {
                      min: 1,
                      digitLimit: REPS_DIGIT_LIMIT,
                    }) ?? 1,
                })
              }
              {...numberInputGuardProps()}
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Volume type{" "}
            <span className="text-xs text-ink-subtle">(optional)</span>
            <select
              value={item.volumeType}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_ITEM_FIELD",
                  blockId,
                  itemId: item.id,
                  field: "volumeType",
                  value: e.target.value as VolumeType | "",
                })
              }
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              <option value="">None</option>
              {volumeTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {VOLUME_TYPE_LABELS[value].label}
                </option>
              ))}
            </select>
          </label>

          {item.volumeType !== "" && (
            <label className="flex flex-col gap-1 text-sm">
              Volume value (leave empty for Open Ended){" "}
              <span className="text-xs text-ink-subtle">(optional)</span>
              {item.volumeType === "duration" ? (
                <DurationInput
                  maxUnit="hours"
                  valueSeconds={item.volumeValue}
                  onChange={(value) =>
                    dispatch({
                      type: "UPDATE_ITEM_FIELD",
                      blockId,
                      itemId: item.id,
                      field: "volumeValue",
                      value,
                    })
                  }
                />
              ) : item.volumeType === "distance" ? (
                <DistanceInput
                  key={isHyroxStation ? "hyrox" : "standard"}
                  unitSystem={unitSystem}
                  isHyroxStation={isHyroxStation}
                  digitLimit={ITEM_DISTANCE_DIGIT_LIMIT}
                  valueMetres={item.volumeValue}
                  onChange={(value) =>
                    dispatch({
                      type: "UPDATE_ITEM_FIELD",
                      blockId,
                      itemId: item.id,
                      field: "volumeValue",
                      value,
                    })
                  }
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  step={item.volumeType === "calories" ? 10 : 1}
                  value={item.volumeValue ?? ""}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_ITEM_FIELD",
                      blockId,
                      itemId: item.id,
                      field: "volumeValue",
                      // Same two limits validateBuilderPayload's own
                      // volume_type switch uses for this pair (distance
                      // goes through DistanceInput above instead).
                      value: sanitizeNumberInputChange(e, {
                        min: 0,
                        digitLimit:
                          item.volumeType === "calories"
                            ? ITEM_CALORIES_DIGIT_LIMIT
                            : REPS_DIGIT_LIMIT,
                      }),
                    })
                  }
                  {...numberInputGuardProps()}
                  className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                />
              )}
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Target <span className="text-xs text-ink-subtle">(optional)</span>
            <select
              value={targetMode}
              onChange={(e) =>
                handleTargetModeChange(e.target.value as TargetMode)
              }
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              <option value="none">None</option>
              <option value="intensity_zone">Intensity zone</option>
              <option value="rpe">{TARGET_TYPE_LABELS.rpe.label}</option>
              <option value="pace">Pace</option>
              <option value="cal_per_hour">
                {TARGET_TYPE_LABELS.cal_per_hour.label}
              </option>
              <option value="watts">{TARGET_TYPE_LABELS.watts.label}</option>
            </select>
          </label>

          {targetMode === "intensity_zone" && (
            <label className="flex flex-col gap-1 text-sm">
              Intensity zone
              <select
                value={item.targetPreset}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_ITEM_FIELD",
                    blockId,
                    itemId: item.id,
                    field: "targetPreset",
                    value: e.target.value as TargetPreset | "",
                  })
                }
                className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              >
                <option value="" disabled>
                  Select a zone
                </option>
                {targetPresetOptions.map((value) => (
                  <option key={value} value={value}>
                    {TARGET_PRESET_LABELS[value].label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {targetMode === "rpe" && (
            <label className="flex flex-col gap-1 text-sm">
              {TARGET_TYPE_LABELS.rpe.label}{" "}
              <span className="text-xs text-ink-subtle">(optional)</span>
              <input
                type="number"
                min={1}
                max={10}
                step={1}
                value={item.targetValue ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_ITEM_FIELD",
                    blockId,
                    itemId: item.id,
                    field: "targetValue",
                    // Clamped on every keystroke, not just guarded by the
                    // min/max attributes above — those only affect the
                    // native spinner/blur validation, which noValidate on
                    // the builder's <form> turns off, and typing "11" or
                    // "-5" directly bypasses them regardless. No matching
                    // DigitLimit constant exists (or is needed): the 1-10
                    // range is already tighter than any digit-count cap, so
                    // `integer: true` alone gets the whole-number rule
                    // sanitizeLiveNumber's digitLimit branch would
                    // otherwise provide.
                    value: sanitizeNumberInputChange(e, {
                      min: 1,
                      max: 10,
                      integer: true,
                    }),
                  })
                }
                {...numberInputGuardProps()}
                className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              />
            </label>
          )}

          {targetMode === "pace" && (
            <label className="flex flex-col gap-1 text-sm">
              Pace <span className="text-xs text-ink-subtle">(optional)</span>
              <div className="flex items-center gap-2">
                <DurationInput
                  key={paceDisplayUnit}
                  maxUnit="minutes"
                  valueSeconds={paceValueForDisplay(
                    item.targetValue,
                    paceDisplayUnit
                  )}
                  onChange={handlePaceValueChange}
                />
                <select
                  value={paceDisplayUnit}
                  onChange={(e) =>
                    handlePaceUnitChange(e.target.value as PaceDisplayUnit)
                  }
                  aria-label="Pace unit"
                  className="h-11 rounded-md border border-hairline bg-surface-1 px-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                >
                  <option value="500m">/500m</option>
                  <option value="km">/km</option>
                  <option value="mi">/mi</option>
                </select>
              </div>
            </label>
          )}

          {(targetMode === "cal_per_hour" || targetMode === "watts") && (
            <label className="flex flex-col gap-1 text-sm">
              {TARGET_TYPE_LABELS[targetMode].label}{" "}
              <span className="text-xs text-ink-subtle">(optional)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={item.targetValue ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_ITEM_FIELD",
                    blockId,
                    itemId: item.id,
                    field: "targetValue",
                    // Cal/h and watts share ITEM_TARGET_RATE_DIGIT_LIMIT
                    // here too — same constant validateBuilderPayload
                    // checks target_value against for both.
                    value: sanitizeNumberInputChange(e, {
                      min: 0,
                      digitLimit: ITEM_TARGET_RATE_DIGIT_LIMIT,
                    }),
                  })
                }
                {...numberInputGuardProps()}
                className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Weight in kg{" "}
            <span className="text-xs text-ink-subtle">(optional)</span>
            <input
              type="number"
              min={0}
              step={2.5}
              value={item.weightKg ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_ITEM_FIELD",
                  blockId,
                  itemId: item.id,
                  field: "weightKg",
                  // LIFTED_WEIGHT_DIGIT_LIMIT allows one decimal (12.5 kg) —
                  // the one field here where a decimal point stays valid.
                  value: sanitizeNumberInputChange(e, {
                    min: 0,
                    digitLimit: LIFTED_WEIGHT_DIGIT_LIMIT,
                    allowDecimal: true,
                  }),
                })
              }
              {...numberInputGuardProps({ allowDecimal: true })}
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Rest <span className="text-xs text-ink-subtle">(optional)</span>
            <DurationInput
              maxUnit="minutes"
              valueSeconds={item.restSeconds}
              onChange={(value) =>
                dispatch({
                  type: "UPDATE_ITEM_FIELD",
                  blockId,
                  itemId: item.id,
                  field: "restSeconds",
                  value,
                })
              }
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Notes <span className="text-xs text-ink-subtle">(optional)</span>
            <textarea
              value={item.notes}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_ITEM_FIELD",
                  blockId,
                  itemId: item.id,
                  field: "notes",
                  value: e.target.value,
                })
              }
              className="rounded-md border border-hairline bg-surface-1 px-4 py-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Done
          </button>
        </div>
      </Modal>
    </li>
  );
}
