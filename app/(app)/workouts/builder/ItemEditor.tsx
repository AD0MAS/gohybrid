import { useState, type Dispatch } from "react";
import { Pencil, StickyNote, X } from "lucide-react";
import type { unitSystemEnum } from "@/db/schema";
import {
  formatDistanceMetres,
  formatDurationSeconds,
  formatWeightKg,
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
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  dispatch: Dispatch<BuilderAction>;
};

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
  targetTypeOptions,
  targetPresetOptions,
  unitSystem,
  dispatch,
}: ItemEditorProps) {
  const [open, setOpen] = useState(autoOpen);
  const exercise = catalog.find(
    (candidate) => candidate.id === item.exerciseId
  );
  const isHyroxStation = exercise?.isHyroxStation ?? false;
  const itemName = exercise?.name || item.customName || "New item";
  const summary = formatItemSummary(item, unitSystem, isHyroxStation);
  const hasNotes = item.notes.trim() !== "";

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
                  value: e.target.value === "" ? 1 : Number(e.target.value),
                })
              }
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
                      value:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                />
              )}
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Target preset{" "}
            <span className="text-xs text-ink-subtle">(optional)</span>
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
              <option value="">None</option>
              {targetPresetOptions.map((value) => (
                <option key={value} value={value}>
                  {TARGET_PRESET_LABELS[value].label}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-ink-subtle">
            Or set a target type and value instead of a preset:
          </p>

          <label className="flex flex-col gap-1 text-sm">
            Target type{" "}
            <span className="text-xs text-ink-subtle">(optional)</span>
            <select
              value={item.targetType}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_ITEM_FIELD",
                  blockId,
                  itemId: item.id,
                  field: "targetType",
                  value: e.target.value as TargetType | "",
                })
              }
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              <option value="">None</option>
              {targetTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {TARGET_TYPE_LABELS[value].label}
                </option>
              ))}
            </select>
          </label>

          {item.targetType !== "" && (
            <label className="flex flex-col gap-1 text-sm">
              Target value{" "}
              <span className="text-xs text-ink-subtle">(optional)</span>
              <input
                type="number"
                step="any"
                value={item.targetValue ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_ITEM_FIELD",
                    blockId,
                    itemId: item.id,
                    field: "targetValue",
                    value:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
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
                  value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
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
