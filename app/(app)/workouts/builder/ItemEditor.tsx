import { useId, useRef, useState, type Dispatch } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Pencil, StickyNote, X } from "lucide-react";
import type { UNIT_SYSTEMS } from "@/db/enums";
import { FieldError } from "@/app/_components/FormStatus";
import {
  ITEM_CALORIES_DIGIT_LIMIT,
  ITEM_DISTANCE_DIGIT_LIMIT,
  ITEM_TARGET_RATE_DIGIT_LIMIT,
  LIFTED_WEIGHT_DIGIT_LIMIT,
  REPS_DIGIT_LIMIT,
  SETS_DIGIT_LIMIT,
} from "@/lib/numeric-limits";
import { LONG_TEXT_MAX_LENGTH } from "@/lib/text-limits";
import {
  secondsPerKmToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
} from "@/lib/units";
import {
  validateBuilderItemDraft,
  type BuilderItemDraftErrors,
} from "@/lib/workout-builder-validation";
import { formatItemSummary } from "@/lib/workout-summary";
import CardMenu, {
  MENU_ITEM_CLASSES,
  MENU_ITEM_DANGER_CLASSES,
} from "../../_components/CardMenu";
import DistanceInput from "../../_components/DistanceInput";
import DurationInput from "../../_components/DurationInput";
import Modal from "../../_components/Modal";
import DragHandle from "./DragHandle";
import type { BuilderSortableData } from "./dnd";
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
import { FIELD_CLASSES_SURFACE_1, SUBMIT_BUTTON_CLASSES } from "../../_components/shared-classes";

const ITEM_SUMMARY_LABELS = {
  targetPreset: TARGET_PRESET_LABELS,
  targetType: TARGET_TYPE_LABELS,
};

const ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
const DANGER_ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-danger active:bg-surface-2 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

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
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  unitSystem: (typeof UNIT_SYSTEMS)[number];
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
 * then held as ItemEditorModalFields' own local state (see its doc
 * comment there) — "intensity_zone" with no preset chosen yet is
 * indistinguishable from "none" in stored data, so it can't be re-derived
 * on every render.
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
 * local useState in ItemEditorModalFields, seeded from the saved item's
 * target_type and the unitSystem prop (see its own paceDisplayUnit
 * initializer). "500m" is target_type = pace_500m's only unit; "km"/"mi"
 * are both target_type = pace_km, converted for display via
 * secondsPerKmToSecondsPerMile — same canonical-value-plus-display-unit
 * split as DistanceInput's own unit select.
 */
type PaceDisplayUnit = "500m" | "km" | "mi";

/** The one of "km"/"mi" the Pace unit select offers alongside "500m", for a
 * given user's unit system — "km" and "mi" are two display labels for the
 * same stored seconds-per-km value (see PaceDisplayUnit above), not two
 * distinct scales the way DistanceInput's m/km or ft/mi are, so only the one
 * matching unit_system is ever shown or seeded. Shared by the select's
 * option list, paceDisplayUnit's initializer, and updateExerciseId's
 * becomingRest reset, so the three can't drift. */
function defaultPaceUnitFor(
  unitSystem: (typeof UNIT_SYSTEMS)[number]
): "km" | "mi" {
  return unitSystem === "imperial" ? "mi" : "km";
}

/** Derives which of the six Target modes a *freshly loaded* item is in from
 * its stored fields — used only to seed ItemEditorModalFields' local
 * targetMode state once (see its doc comment), never called again
 * afterwards. An item whose targetPreset and targetType are both empty
 * reads as "none" here, which is correct for a genuinely untouched item;
 * the "Intensity zone chosen, no zone picked yet" case that also has both
 * empty only exists as UI-session state, never as something LOAD_WORKOUT
 * could hand back. */
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

/** The draft ItemEditorModalFields edits: every one of an item's editable
 * fields except `id` — everything the modal's Save button commits to the
 * reducer in one go. Kept as its own type (rather than reused directly)
 * so it's obvious at a glance which fields the modal actually owns, same
 * as BlockEditor's BlockDraft. */
type ItemDraft = {
  exerciseId: string | null;
  customName: string | null;
  sets: number | null;
  volumeType: VolumeType | "";
  volumeValue: number | null;
  targetType: TargetType | "";
  targetValue: number | null;
  targetPreset: TargetPreset | "";
  weightKg: number | null;
  restSeconds: number | null;
  notes: string;
};

function draftFromItem(item: BuilderItem): ItemDraft {
  return {
    exerciseId: item.exerciseId,
    customName: item.customName,
    sets: item.sets,
    volumeType: item.volumeType,
    volumeValue: item.volumeValue,
    targetType: item.targetType,
    targetValue: item.targetValue,
    targetPreset: item.targetPreset,
    weightKg: item.weightKg,
    restSeconds: item.restSeconds,
    notes: item.notes,
  };
}

/**
 * Editor for a single item within a block: a summary row (exercise/custom
 * name, then the compact line from formatItemSummary — sets × volume,
 * target, weight, rest for a regular item, or just the mm:ss / "Open
 * ended" for a rest item, with no "Rest" prefix since the name line above
 * already says it — plus a StickyNote icon when notes are set) always
 * shown in the block's item list, plus a Configure control opening
 * a Modal with the full editor. For a regular item that's exercise
 * selection (via ExercisePicker), then sets, volume (both required —
 * change 1), target, weight, rest, and notes; for a rest item (exerciseId
 * resolving to an exercises.category = "rest" row — change 2) it collapses
 * to just the exercise picker and one optional rest_seconds time field,
 * since sets/volume/target/weight/notes don't apply to a rest period. A
 * distance volume_value renders DistanceInput in its controlled
 * (valueMetres + onChange) mode, same as DurationInput for a duration one —
 * item.volumeValue stays metres in builder state either way, so
 * createFullWorkout/updateFullWorkout need no unit awareness of their own.
 * `isHyroxStation` and `isRestItem` are both looked up from `catalog` by
 * the (draft) exerciseId, same pattern as PersonalRecordFields/GoalFields
 * uses for `isHyroxStation`. target_type + target_value and target_preset
 * are alternatives: picking one clears the other.
 *
 * The modal is a draft, not a live view of the reducer — mirrors
 * BlockEditor exactly (see its own doc comment for the full rationale):
 * ItemEditorModalFields (below) holds its own copy of every editable
 * field, seeded from `item` fresh on every open — remounted via
 * `key={openCount}`. Fields inside the modal read and write that local
 * draft; nothing dispatches until Save. Closing via the X, Esc, or a
 * backdrop click discards the draft outright; for an item that autoOpen
 * just created and that has never been saved even once, it also
 * REMOVE_ITEMs the item itself. `wasAutoCreated` captures `autoOpen` once
 * at mount rather than reading the prop live, since BlockEditor clears
 * `lastAddedItemId` after use. `hasSavedRef` doesn't need to be state:
 * it's only ever read inside the close handler, an event, never during
 * render.
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
  targetTypeOptions,
  targetPresetOptions,
  unitSystem,
  dispatch,
}: ItemEditorProps) {
  const [wasAutoCreated] = useState(autoOpen);
  const [open, setOpen] = useState(autoOpen);
  const [openCount, setOpenCount] = useState(0);
  const hasSavedRef = useRef(false);

  const exercise = catalog.find(
    (candidate) => candidate.id === item.exerciseId
  );
  const isHyroxStation = exercise?.isHyroxStation ?? false;
  const isRestItem = exercise?.category === "rest";
  const itemName = exercise?.name || item.customName || "New item";
  const summary = formatItemSummary(
    { ...item, isRestItem, isHyroxStation },
    unitSystem,
    ITEM_SUMMARY_LABELS
  );
  const hasNotes = item.notes.trim() !== "";

  const sortableData: BuilderSortableData = { type: "item", blockId };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: sortableData });

  function duplicate() {
    dispatch({ type: "DUPLICATE_ITEM", blockId, itemId: item.id });
  }

  function remove() {
    dispatch({ type: "REMOVE_ITEM", blockId, itemId: item.id });
  }

  function openFresh() {
    setOpenCount((count) => count + 1);
    setOpen(true);
  }

  function handleModalClose() {
    setOpen(false);
    if (wasAutoCreated && !hasSavedRef.current) {
      dispatch({ type: "REMOVE_ITEM", blockId, itemId: item.id });
    }
  }

  /**
   * Save: commits every field of the draft to the reducer. Sets/volume
   * value/weight/rest/notes each dispatch unconditionally, same
   * "dispatch everything from the draft" approach as BlockEditor's
   * handleSave — volumeType first, since UPDATE_ITEM_FIELD always nulls
   * volumeValue whenever volumeType is dispatched, then volumeValue
   * rebuilds it from the draft. weightKg is the one field dispatched from
   * a locally normalized value rather than straight off the draft — see
   * its own comment just below.
   *
   * exerciseId/customName and targetType/targetPreset/targetValue can't
   * use that same "dispatch everything" approach, though: unlike
   * blockType (which only ever resets fields, never reads them back), the
   * reducer's exerciseId/customName/targetPreset/targetType cases each
   * clear the *other* field of their own pair whenever dispatched — so
   * dispatching both unconditionally would have the second dispatch wipe
   * out what the first one just set. Each pair dispatches only the one
   * field the draft actually holds instead (validation guarantees at
   * least the exercise pair has exactly one set; the target trio is
   * either a preset, a type [+ optional value], or neither — "none" mode
   * dispatching an empty targetPreset to clear all three at once, the
   * same way choosing "none" already clears them in the reducer).
   */
  function handleSave(draft: ItemDraft) {
    // A typed 0 means the same thing as leaving the field blank (a
    // bodyweight movement, not a genuine zero-kilogram load), so it's
    // normalized to null right here, before it ever reaches the reducer —
    // mirrors parseBuilderItem's own conversion (lib/workout-builder-
    // validation.ts), which only runs when the whole workout is saved and
    // so left "0 kg" sitting in the summary row between an item Save and
    // the next workout Save. parseBuilderItem's conversion stays: it's
    // still what a direct POST /api/workouts/full or PATCH
    // /api/workouts/[id]/full call goes through, and that path never
    // touches this component at all.
    const weightKg = draft.weightKg === 0 ? null : draft.weightKg;

    if (draft.exerciseId !== null) {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "exerciseId",
        value: draft.exerciseId,
      });
    } else if (draft.customName !== null) {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "customName",
        value: draft.customName,
      });
    }

    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId: item.id,
      field: "sets",
      value: draft.sets,
    });

    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId: item.id,
      field: "volumeType",
      value: draft.volumeType,
    });
    if (draft.volumeValue !== null) {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "volumeValue",
        value: draft.volumeValue,
      });
    }

    if (draft.targetPreset !== "") {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "targetPreset",
        value: draft.targetPreset,
      });
    } else if (draft.targetType !== "") {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "targetType",
        value: draft.targetType,
      });
      if (draft.targetValue !== null) {
        dispatch({
          type: "UPDATE_ITEM_FIELD",
          blockId,
          itemId: item.id,
          field: "targetValue",
          value: draft.targetValue,
        });
      }
    } else {
      dispatch({
        type: "UPDATE_ITEM_FIELD",
        blockId,
        itemId: item.id,
        field: "targetPreset",
        value: "",
      });
    }

    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId: item.id,
      field: "weightKg",
      value: weightKg,
    });
    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId: item.id,
      field: "restSeconds",
      value: draft.restSeconds,
    });
    dispatch({
      type: "UPDATE_ITEM_FIELD",
      blockId,
      itemId: item.id,
      field: "notes",
      value: draft.notes,
    });

    dispatch({ type: "CONFIRM_ITEM", blockId, itemId: item.id });
    hasSavedRef.current = true;
    setOpen(false);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex min-w-0 items-start justify-between gap-3 rounded-card border border-hairline bg-surface-3 px-3 py-2.5 ${
        isDragging ? "relative z-10 opacity-70" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <DragHandle
          label="Reorder item"
          setActivatorNodeRef={setActivatorNodeRef}
          attributes={attributes}
          listeners={listeners}
        />
        <div className="flex min-w-0 flex-col gap-1 pt-1">
          <p className="break-words text-[13px] font-medium text-ink-muted">
            {itemName}
          </p>
          {(summary || hasNotes) && (
            <p className="break-words text-xs text-ink-tertiary">
              {summary}
              {hasNotes && (
                <>
                  {summary && " "}
                  <StickyNote
                    className="inline h-3.5 w-3.5 align-middle"
                    aria-label="Has notes"
                  />
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        <button
          type="button"
          onClick={openFresh}
          aria-label="Configure"
          className={ICON_BUTTON_CLASSES}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={duplicate}
          aria-label="Duplicate item"
          className={ICON_BUTTON_CLASSES}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label="Remove item"
          className={DANGER_ICON_BUTTON_CLASSES}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="shrink-0 sm:hidden">
        <CardMenu>
          <button type="button" onClick={openFresh} className={MENU_ITEM_CLASSES}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
          <button type="button" onClick={duplicate} className={MENU_ITEM_CLASSES}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Duplicate
          </button>
          <button type="button" onClick={remove} className={MENU_ITEM_DANGER_CLASSES}>
            <X className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </CardMenu>
      </div>

      <Modal open={open} onClose={handleModalClose} title={itemName}>
        <ItemEditorModalFields
          key={openCount}
          item={item}
          catalog={catalog}
          volumeTypeOptions={volumeTypeOptions}
          targetTypeOptions={targetTypeOptions}
          targetPresetOptions={targetPresetOptions}
          unitSystem={unitSystem}
          onSave={handleSave}
        />
      </Modal>
    </li>
  );
}

type ItemEditorModalFieldsProps = {
  /** Only ever read to seed the draft's initial state (this component is
   * remounted on every open — see ItemEditor's own doc comment) — never
   * read again after mount. */
  item: BuilderItem;
  catalog: readonly CatalogExercise[];
  volumeTypeOptions: readonly VolumeType[];
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  unitSystem: (typeof UNIT_SYSTEMS)[number];
  onSave: (draft: ItemDraft) => void;
};

/**
 * The modal's actual fields — a local draft, seeded once from `item` at
 * mount (see ItemEditor's doc comment for why this is its own component,
 * keyed on `openCount`, rather than state living directly in ItemEditor).
 * Every field here reads and writes `draft`, never `item` and never
 * `dispatch` directly; Save is the only thing that ever hands anything
 * back to the parent.
 *
 * `targetMode` and `paceDisplayUnit` live here rather than in ItemEditor
 * (where they used to live, back when every field dispatched directly) —
 * both need to write into `draft` on change (crossing the pace 500m/km-mi
 * boundary is a real targetType change; switching Target mode rewrites
 * targetPreset/targetType/targetValue together), and only the component
 * that owns `draft` can do that. Both are still seeded fresh on every
 * open, via the same `key={openCount}` remount as everything else: opening
 * a saved item re-derives `targetMode` from deriveTargetMode(item) and
 * `paceDisplayUnit` from item.targetType/unitSystem again, off the
 * committed reducer state, which only ever changes via a successful Save
 * — so a saved item always reopens in the mode/unit it was saved in, and
 * a mode switched during an abandoned (cancelled) session never leaks
 * into the next open.
 *
 * Errors clear themselves without a useEffect, same idiom as
 * BlockEditorModalFields: each field's own update function already knows
 * exactly which field(s) it just changed, so it clears those in the same
 * call that updates `draft` — nothing to "notice" after the fact.
 */
function ItemEditorModalFields({
  item,
  catalog,
  volumeTypeOptions,
  targetTypeOptions,
  targetPresetOptions,
  unitSystem,
  onSave,
}: ItemEditorModalFieldsProps) {
  const [draft, setDraft] = useState<ItemDraft>(() => draftFromItem(item));
  const [errors, setErrors] = useState<BuilderItemDraftErrors>({});
  const uid = useId();
  /** Same always-present-id idiom as BlockEditorModalFields — see its
   * comment. */
  const errorId = (field: keyof BuilderItemDraftErrors) => `${uid}-${field}-error`;
  const describedByFor = (field: keyof BuilderItemDraftErrors) =>
    errors[field] ? errorId(field) : undefined;
  const [targetMode, setTargetMode] = useState<TargetMode>(() =>
    deriveTargetMode(item)
  );
  const [paceDisplayUnit, setPaceDisplayUnit] = useState<PaceDisplayUnit>(
    () => {
      if (item.targetType === "pace_500m") return "500m";
      return defaultPaceUnitFor(unitSystem);
    }
  );

  function clearErrors(fields: (keyof BuilderItemDraftErrors)[]) {
    setErrors((e) => {
      if (fields.every((field) => !(field in e))) return e;
      const next = { ...e };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  /**
   * Selecting a catalog exercise (or clearing back to unselected). When the
   * newly selected exercise is a rest exercise (category "rest"), every
   * field the rest-item modal hides — sets, volume, target, weight, notes —
   * is cleared from the draft rather than merely left in place and unsaved:
   * those fields become invisible the moment this fires, and a value the
   * user can no longer see or edit is exactly the kind of stale state the
   * rest of this builder avoids (e.g. UPDATE_ITEM_FIELD's own volumeType
   * case nulling volumeValue in reducer.ts). restSeconds is deliberately
   * NOT cleared here — it's the one field a rest item keeps, and switching
   * the other direction (rest → regular) leaves it in place too, since it's
   * a legitimate "Rest between sets" value either way. targetMode/
   * paceDisplayUnit are reset alongside the target fields they drive, for
   * the same reason.
   */
  function updateExerciseId(value: string | null) {
    const nextExercise = catalog.find((candidate) => candidate.id === value);
    const becomingRest = nextExercise?.category === "rest";
    setDraft((d) => ({
      ...d,
      exerciseId: value,
      customName: null,
      ...(becomingRest
        ? {
            sets: null,
            volumeType: "" as const,
            volumeValue: null,
            targetType: "" as const,
            targetValue: null,
            targetPreset: "" as const,
            weightKg: null,
            notes: "",
          }
        : {}),
    }));
    clearErrors([
      "exercise",
      ...(becomingRest
        ? (["sets", "volumeType", "volumeValue", "targetType", "targetValue", "targetPreset", "weightKg"] as const)
        : []),
    ]);
    if (becomingRest) {
      setTargetMode("none");
      setPaceDisplayUnit(defaultPaceUnitFor(unitSystem));
    }
  }

  function updateCustomName(value: string) {
    setDraft((d) => ({ ...d, customName: value, exerciseId: null }));
    clearErrors(["exercise"]);
  }

  function updateSets(value: number | null) {
    setDraft((d) => ({ ...d, sets: value }));
    clearErrors(["sets"]);
  }

  function updateVolumeType(value: VolumeType | "") {
    setDraft((d) => ({ ...d, volumeType: value, volumeValue: null }));
    clearErrors(["volumeType", "volumeValue"]);
  }

  function updateVolumeValue(value: number | null) {
    setDraft((d) => ({ ...d, volumeValue: value }));
    clearErrors(["volumeValue"]);
  }

  function updateWeightKg(value: number | null) {
    setDraft((d) => ({ ...d, weightKg: value }));
    clearErrors(["weightKg"]);
  }

  function updateRestSeconds(value: number | null) {
    setDraft((d) => ({ ...d, restSeconds: value }));
    clearErrors(["restSeconds"]);
  }

  function updateNotes(value: string) {
    setDraft((d) => ({ ...d, notes: value }));
  }

  /**
   * Switches Target mode. "none" and "intensity_zone" both clear
   * targetPreset/targetType/targetValue together in the draft — entering
   * Intensity zone doesn't eagerly pick a preset (see the sub-select's
   * placeholder option); only `targetMode` (set unconditionally, below)
   * tells the two apart afterwards. The other four modes set targetType
   * (clearing targetPreset/targetValue alongside it, same pairing the
   * reducer's own targetType case uses for committed state).
   */
  function handleTargetModeChange(mode: TargetMode) {
    setTargetMode(mode);
    if (mode === "none" || mode === "intensity_zone") {
      setDraft((d) => ({
        ...d,
        targetPreset: "",
        targetType: "",
        targetValue: null,
      }));
      clearErrors(["targetPreset", "targetType", "targetValue"]);
      return;
    }
    const targetType: TargetType =
      mode === "pace"
        ? paceDisplayUnit === "500m"
          ? "pace_500m"
          : "pace_km"
        : mode;
    setDraft((d) => ({
      ...d,
      targetType,
      targetPreset: "",
      targetValue: null,
    }));
    clearErrors(["targetPreset", "targetType", "targetValue"]);
  }

  function updateTargetPreset(value: TargetPreset | "") {
    setDraft((d) => ({ ...d, targetPreset: value }));
    clearErrors(["targetPreset"]);
  }

  function updateTargetValue(value: number | null) {
    setDraft((d) => ({ ...d, targetValue: value }));
    clearErrors(["targetValue"]);
  }

  /**
   * Switches the Pace value box's display unit. The select only ever offers
   * "500m" and whichever one of "km"/"mi" matches unitSystem (see
   * defaultPaceUnitFor), so the only transition this ever handles is
   * crossing that "500m" boundary — a real target_type change (pace_500m
   * and pace_km are not interconvertible — see secondsPerKmToSecondsPerMile's
   * doc comment), updating the draft (comparing against the draft's own
   * targetType, not item's, since it's the draft that might already differ
   * from the committed item this session). A same-group "km"-to-"mi" (or
   * reverse) switch with no targetType change can no longer happen within
   * one session: both belonged to the same unitSystem, which doesn't change
   * without remounting this component. The targetType comparison below is
   * harmless either way — it's just never false for a same-group switch
   * anymore.
   */
  function handlePaceUnitChange(unit: PaceDisplayUnit) {
    const targetType: TargetType = unit === "500m" ? "pace_500m" : "pace_km";
    if (targetType !== draft.targetType) {
      setDraft((d) => ({
        ...d,
        targetType,
        targetPreset: "",
        targetValue: null,
      }));
      clearErrors(["targetType", "targetPreset", "targetValue"]);
    }
    setPaceDisplayUnit(unit);
  }

  function handlePaceValueChange(seconds: number | null) {
    updateTargetValue(paceValueFromDisplay(seconds, paceDisplayUnit));
  }

  const exercise = catalog.find(
    (candidate) => candidate.id === draft.exerciseId
  );
  const isHyroxStation = exercise?.isHyroxStation ?? false;
  const isRestItem = exercise?.category === "rest";

  function handleSaveClick() {
    // Computed from `catalog`, which every caller of
    // validateBuilderItemDraft/validateBuilderPayload already has, rather
    // than threaded down as its own prop — see BuilderEnumOptions'
    // restExerciseIds doc comment in lib/workout-builder-validation.ts.
    const restExerciseIds = catalog
      .filter((candidate) => candidate.category === "rest")
      .map((candidate) => candidate.id);
    const validationErrors = validateBuilderItemDraft(
      {
        exerciseId: draft.exerciseId,
        customName: draft.customName,
        sets: draft.sets,
        volumeType: draft.volumeType,
        volumeValue: draft.volumeValue,
        targetType: draft.targetType,
        targetValue: draft.targetValue,
        targetPreset: draft.targetPreset,
        weightKg: draft.weightKg,
        restSeconds: draft.restSeconds,
      },
      { volumeTypeOptions, targetTypeOptions, targetPresetOptions, restExerciseIds }
    );
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(draft);
  }

  return (
    <div className="flex flex-col gap-3">
      <ExercisePicker
        exerciseId={draft.exerciseId}
        customName={draft.customName}
        catalog={catalog}
        onChangeExerciseId={updateExerciseId}
        onChangeCustomName={updateCustomName}
        error={errors.exercise}
        errorId={errorId("exercise")}
      />

      {isRestItem ? (
        // A rest item (change 2): sets/volume/target/weight/notes don't
        // apply to a rest period, so only the exercise picker above and
        // this one optional rest_seconds time field remain — a rest item
        // saves with no time at all.
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1">
              Time<span className="text-xs text-ink-subtle">(optional)</span>
            </span>
            <DurationInput
              maxUnit="minutes"
              valueSeconds={draft.restSeconds}
              onChange={updateRestSeconds}
              describedBy={describedByFor("restSeconds")}
            />
          </label>
          <FieldError id={errorId("restSeconds")} error={errors.restSeconds} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 text-sm">
            <label className="flex flex-col gap-1">
              Sets
              <input
                type="number"
                min={1}
                step={1}
                required
                value={draft.sets ?? ""}
                onChange={(e) =>
                  updateSets(
                    sanitizeNumberInputChange(e, {
                      min: 1,
                      digitLimit: SETS_DIGIT_LIMIT,
                    })
                  )
                }
                {...numberInputGuardProps()}
                aria-invalid={errors.sets ? true : undefined}
                aria-describedby={describedByFor("sets")}
                className={FIELD_CLASSES_SURFACE_1}
              />
            </label>
            <FieldError id={errorId("sets")} error={errors.sets} />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <label className="flex flex-col gap-1">
              Volume type
              <select
                value={draft.volumeType}
                onChange={(e) => updateVolumeType(e.target.value as VolumeType | "")}
                aria-invalid={errors.volumeType ? true : undefined}
                aria-describedby={describedByFor("volumeType")}
                className={FIELD_CLASSES_SURFACE_1}
              >
                <option value="" disabled>
                  Select a volume type
                </option>
                {volumeTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {VOLUME_TYPE_LABELS[value].label}
                  </option>
                ))}
              </select>
            </label>
            <FieldError id={errorId("volumeType")} error={errors.volumeType} />
          </div>

          {draft.volumeType !== "" && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex flex-col gap-1">
                Volume value
                {draft.volumeType === "duration" ? (
                  <DurationInput
                    maxUnit="hours"
                    valueSeconds={draft.volumeValue}
                    onChange={updateVolumeValue}
                    describedBy={describedByFor("volumeValue")}
                  />
                ) : draft.volumeType === "distance" ? (
                  <DistanceInput
                    key={isHyroxStation ? "hyrox" : "standard"}
                    unitSystem={unitSystem}
                    isHyroxStation={isHyroxStation}
                    digitLimit={ITEM_DISTANCE_DIGIT_LIMIT}
                    valueMetres={draft.volumeValue}
                    onChange={updateVolumeValue}
                  />
                ) : (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={draft.volumeValue ?? ""}
                    onChange={(e) =>
                      updateVolumeValue(
                        // min: 1 — a volume of 0 reps/calories is meaningless
                        // (fix 2: enforced here, at the input, rather than as
                        // a "> 0" check in validateBuilderItemDraft). Same two
                        // digit limits validateBuilderPayload's own
                        // volume_type switch uses for this pair (distance goes
                        // through DistanceInput above instead).
                        sanitizeNumberInputChange(e, {
                          min: 1,
                          digitLimit:
                            draft.volumeType === "calories"
                              ? ITEM_CALORIES_DIGIT_LIMIT
                              : REPS_DIGIT_LIMIT,
                        })
                      )
                    }
                    {...numberInputGuardProps()}
                    aria-invalid={errors.volumeValue ? true : undefined}
                    aria-describedby={describedByFor("volumeValue")}
                    className={FIELD_CLASSES_SURFACE_1}
                  />
                )}
              </label>
              <FieldError id={errorId("volumeValue")} error={errors.volumeValue} />
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm">
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1">
                Target<span className="text-xs text-ink-subtle">(optional)</span>
              </span>
              <select
                value={targetMode}
                onChange={(e) =>
                  handleTargetModeChange(e.target.value as TargetMode)
                }
                aria-invalid={errors.targetType ? true : undefined}
                aria-describedby={describedByFor("targetType")}
                className={FIELD_CLASSES_SURFACE_1}
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
            <FieldError id={errorId("targetType")} error={errors.targetType} />
          </div>

          {targetMode === "intensity_zone" && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex flex-col gap-1">
                Intensity zone
                <select
                  value={draft.targetPreset}
                  onChange={(e) =>
                    updateTargetPreset(e.target.value as TargetPreset | "")
                  }
                  aria-invalid={errors.targetPreset ? true : undefined}
                  aria-describedby={describedByFor("targetPreset")}
                  className={FIELD_CLASSES_SURFACE_1}
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
              <FieldError id={errorId("targetPreset")} error={errors.targetPreset} />
            </div>
          )}

          {targetMode === "rpe" && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1">
                  {TARGET_TYPE_LABELS.rpe.label}
                  <span className="text-xs text-ink-subtle">(optional)</span>
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={draft.targetValue ?? ""}
                  onChange={(e) =>
                    updateTargetValue(
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
                      sanitizeNumberInputChange(e, {
                        min: 1,
                        max: 10,
                        integer: true,
                      })
                    )
                  }
                  {...numberInputGuardProps()}
                  aria-invalid={errors.targetValue ? true : undefined}
                  aria-describedby={describedByFor("targetValue")}
                  className={FIELD_CLASSES_SURFACE_1}
                />
              </label>
              <FieldError id={errorId("targetValue")} error={errors.targetValue} />
            </div>
          )}

          {targetMode === "pace" && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1">
                  Pace<span className="text-xs text-ink-subtle">(optional)</span>
                </span>
                <div className="flex items-center gap-2">
                  <DurationInput
                    key={paceDisplayUnit}
                    maxUnit="minutes"
                    valueSeconds={paceValueForDisplay(
                      draft.targetValue,
                      paceDisplayUnit
                    )}
                    onChange={handlePaceValueChange}
                    describedBy={describedByFor("targetValue")}
                  />
                  <select
                    value={paceDisplayUnit}
                    onChange={(e) =>
                      handlePaceUnitChange(e.target.value as PaceDisplayUnit)
                    }
                    aria-label="Pace unit"
                    className="h-11 rounded-control border border-hairline bg-surface-1 px-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                  >
                    <option value="500m">/500m</option>
                    <option value={defaultPaceUnitFor(unitSystem)}>
                      /{defaultPaceUnitFor(unitSystem)}
                    </option>
                  </select>
                </div>
              </label>
              <FieldError id={errorId("targetValue")} error={errors.targetValue} />
            </div>
          )}

          {(targetMode === "cal_per_hour" || targetMode === "watts") && (
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1">
                  {TARGET_TYPE_LABELS[targetMode].label}
                  <span className="text-xs text-ink-subtle">(optional)</span>
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.targetValue ?? ""}
                  onChange={(e) =>
                    updateTargetValue(
                      // min: 1 — a cal/h or watts target of 0 means "put in
                      // no effort," not a real intensity to aim for (fix 2:
                      // enforced here rather than in
                      // validateBuilderItemDraft). Cal/h and watts share
                      // ITEM_TARGET_RATE_DIGIT_LIMIT here too — same constant
                      // validateBuilderPayload checks target_value against
                      // for both.
                      sanitizeNumberInputChange(e, {
                        min: 1,
                        digitLimit: ITEM_TARGET_RATE_DIGIT_LIMIT,
                      })
                    )
                  }
                  {...numberInputGuardProps()}
                  aria-invalid={errors.targetValue ? true : undefined}
                  aria-describedby={describedByFor("targetValue")}
                  className={FIELD_CLASSES_SURFACE_1}
                />
              </label>
              <FieldError id={errorId("targetValue")} error={errors.targetValue} />
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm">
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1">
                Weight in kg
                <span className="text-xs text-ink-subtle">(optional)</span>
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={draft.weightKg ?? ""}
                onChange={(e) =>
                  updateWeightKg(
                    // min: 0, not a positive floor — weight has no minimum.
                    // A typed 0 is a legitimate value here (0.5 kg's own
                    // neighbour), unlike sets/reps/etc where 0 is meaningless
                    // — a raised min would clamp it away and, since the
                    // spinner counts up from whatever min is, make the arrows
                    // produce 1.1/2.1/3.1 instead of whole numbers. "0 kg"
                    // reading oddly (same meaning as leaving the field blank)
                    // is instead handled where the value is actually saved:
                    // ItemEditor's handleSave normalizes an exact 0 to null
                    // right before dispatching the draft (so the summary row
                    // never shows it either), and parseBuilderItem
                    // (lib/workout-builder-validation.ts) does the same for a
                    // direct POST /api/workouts/full or PATCH
                    // /api/workouts/[id]/full call, which never reaches this
                    // component at all. The field itself stays optional/
                    // empty-able — min only bounds what a *typed* value
                    // becomes, never forces one. step="any" disables native
                    // step validation —
                    // LIFTED_WEIGHT_DIGIT_LIMIT allows any 0.1 (12.5 kg
                    // included), and the old step 2.5 rejected a typed 82.5's
                    // own neighbours; the spinner arrows default to
                    // incrementing by 1, per the HTML spec.
                    sanitizeNumberInputChange(e, {
                      min: 0,
                      digitLimit: LIFTED_WEIGHT_DIGIT_LIMIT,
                      allowDecimal: true,
                    })
                  )
                }
                {...numberInputGuardProps({ allowDecimal: true })}
                aria-invalid={errors.weightKg ? true : undefined}
                aria-describedby={describedByFor("weightKg")}
                className={FIELD_CLASSES_SURFACE_1}
              />
            </label>
            <FieldError id={errorId("weightKg")} error={errors.weightKg} />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1">
                Rest between sets
                <span className="text-xs text-ink-subtle">(optional)</span>
              </span>
              <DurationInput
                maxUnit="minutes"
                valueSeconds={draft.restSeconds}
                onChange={updateRestSeconds}
                describedBy={describedByFor("restSeconds")}
              />
            </label>
            <FieldError id={errorId("restSeconds")} error={errors.restSeconds} />
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1">
              Notes<span className="text-xs text-ink-subtle">(optional)</span>
            </span>
            <textarea
              maxLength={LONG_TEXT_MAX_LENGTH}
              value={draft.notes}
              onChange={(e) => updateNotes(e.target.value)}
              className="rounded-control border border-hairline bg-surface-1 px-4 py-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>
        </>
      )}

      <button
        type="button"
        onClick={handleSaveClick}
        className={SUBMIT_BUTTON_CLASSES}
      >
        Save
      </button>
    </div>
  );
}
