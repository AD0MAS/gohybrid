import type { Dispatch } from "react";
import ExercisePicker from "./ExercisePicker";
import type {
  BuilderAction,
  BuilderItem,
  CatalogExercise,
  TargetPreset,
  TargetType,
  VolumeType,
} from "./reducer";

type ItemEditorProps = {
  blockId: string;
  item: BuilderItem;
  index: number;
  catalog: readonly CatalogExercise[];
  volumeTypeOptions: readonly VolumeType[];
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  dispatch: Dispatch<BuilderAction>;
};

/**
 * Editor for a single item within a block: exercise selection (via
 * ExercisePicker), then sets, volume, target, weight, rest, and notes —
 * all optional except sets, which defaults to 1. Leaving volume_value
 * empty with a volume_type selected means "Open Ended". target_type +
 * target_value and target_preset are alternatives: picking one clears
 * the other (enforced by the reducer). Not a "use client" file itself —
 * see WorkoutBuilder for the single client boundary.
 */
export default function ItemEditor({
  blockId,
  item,
  index,
  catalog,
  volumeTypeOptions,
  targetTypeOptions,
  targetPresetOptions,
  dispatch,
}: ItemEditorProps) {
  return (
    <li className="flex flex-col gap-2 rounded border border-hairline bg-surface-1 p-5">
      <p className="text-sm font-medium">Item {index + 1}</p>

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
          className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Volume type
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
          className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <option value="">None</option>
          {volumeTypeOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      {item.volumeType !== "" && (
        <label className="flex flex-col gap-1 text-sm">
          Volume value (leave empty for Open Ended)
          <input
            type="number"
            min={0}
            step="any"
            value={item.volumeValue ?? ""}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_ITEM_FIELD",
                blockId,
                itemId: item.id,
                field: "volumeValue",
                value: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Target preset
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
          className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <option value="">None</option>
          {targetPresetOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-ink-subtle">
        Or set a target type and value instead of a preset:
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Target type
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
          className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <option value="">None</option>
          {targetTypeOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      {item.targetType !== "" && (
        <label className="flex flex-col gap-1 text-sm">
          Target value
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
                value: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Weight in kg
        <input
          type="number"
          min={0}
          step="any"
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
          className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Rest in seconds
        <input
          type="number"
          min={0}
          step={1}
          value={item.restSeconds ?? ""}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_ITEM_FIELD",
              blockId,
              itemId: item.id,
              field: "restSeconds",
              value: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notes
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
          className="rounded border border-hairline bg-surface-1 px-4 py-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </label>

      <button
        type="button"
        onClick={() =>
          dispatch({ type: "REMOVE_ITEM", blockId, itemId: item.id })
        }
        className="self-start text-sm text-ink-subtle underline hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        Remove item
      </button>
    </li>
  );
}
