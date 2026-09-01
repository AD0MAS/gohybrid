"use client";

import { useReducer, useState } from "react";
import type { unitSystemEnum } from "@/db/schema";
import { FormPendingBanner, SubmitButton } from "@/app/_components/FormStatus";
import { validateBuilderPayload } from "@/lib/workout-builder-validation";
import { TAG_COLOR_CLASSES } from "../tag-colors";
import { createFullWorkout, updateFullWorkout } from "./actions";
import BlockEditor from "./BlockEditor";
import {
  builderReducer,
  createInitialBuilderState,
  type BlockType,
  type BuilderState,
  type CatalogExercise,
  type CatalogTag,
  type Difficulty,
  type LoadableWorkout,
  type PrimaryType,
  type TargetPreset,
  type TargetType,
  type VolumeType,
} from "./reducer";

/**
 * Flattens the builder's internal {meta, blocks} state into the flat
 * shape validateBuilderPayload/createFullWorkout expect — the same
 * shape POST /api/workouts/full accepts as JSON. Each block/item's
 * client-only `id` rides along harmlessly; the validator only reads the
 * fields it knows about.
 */
function toBuilderPayload(state: BuilderState) {
  return {
    title: state.meta.title,
    description: state.meta.description,
    primaryType: state.meta.primaryType,
    difficulty: state.meta.difficulty,
    estimatedDurationMinutes: state.meta.estimatedDurationMinutes,
    blocks: state.blocks,
    tagIds: state.meta.tagIds,
  };
}

type WorkoutBuilderProps = {
  primaryTypeOptions: readonly PrimaryType[];
  difficultyOptions: readonly Difficulty[];
  blockTypeOptions: readonly BlockType[];
  volumeTypeOptions: readonly VolumeType[];
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  exerciseCatalog: readonly CatalogExercise[];
  tagCatalog: readonly CatalogTag[];
  /** Threaded down to every item's DistanceInput (via BlockEditor/
   * ItemEditor) for its unit <select> — the read-only page fetches this
   * once via getUserContext, same as PersonalRecordFields/GoalFields. */
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  /** When present, the builder starts pre-loaded from this workout (via
   * the LOAD_WORKOUT reducer action) and Save edits it in place instead
   * of creating a new one. */
  initialWorkout?: LoadableWorkout;
  /** The workout being edited. Required together with `initialWorkout` —
   * both present means edit mode, both absent means create mode. */
  workoutId?: string;
};

/**
 * Client-side workout builder: workout meta fields (including a tag
 * multi-select over the tag catalog), then a list of blocks with
 * add/remove controls. The whole tree lives in useReducer state until
 * Save. In create mode (no `initialWorkout`/`workoutId`),
 * Save calls the createFullWorkout Server Action; in edit mode, it calls
 * updateFullWorkout instead, which replaces the existing workout's whole
 * tree. Either way, Save runs validateBuilderPayload locally first, for
 * immediate feedback, then re-validates server-side, since the client
 * check is only a UX convenience. Enum option lists are passed in as
 * props from the (Server Component) page rather than imported here, so
 * this file never bundles drizzle-orm into the client. This is the
 * single "use client" boundary for the builder; BlockEditor is a plain
 * function component rendered from here, not its own client boundary.
 *
 * The whole tree is wrapped in a <form action={handleSave}> (rather than a
 * plain <div> with an onClick'd Save button) purely to give useFormStatus
 * something to read: SubmitButton/FormPendingBanner (app/_components/
 * FormStatus.tsx) need a <form> ancestor to report pending state from.
 * handleSave takes no parameters — React calls a form action with the
 * submitted FormData, but every field here is controlled via the reducer
 * and none of them carry a `name`, so there'd be nothing in it to read.
 * No BlockEditor/ItemEditor button is `type="submit"`, so pressing Enter
 * in a text field is the only new way to trigger it. No FormSuccessBanner: both
 * createFullWorkout and updateFullWorkout redirect() on success, so the
 * component unmounts before any success state could render — same
 * reasoning as SettingsFields.
 */
export default function WorkoutBuilder({
  primaryTypeOptions,
  difficultyOptions,
  blockTypeOptions,
  volumeTypeOptions,
  targetTypeOptions,
  targetPresetOptions,
  exerciseCatalog,
  tagCatalog,
  unitSystem,
  initialWorkout,
  workoutId,
}: WorkoutBuilderProps) {
  const [state, dispatch] = useReducer(
    builderReducer,
    initialWorkout,
    (workout) =>
      workout
        ? builderReducer(createInitialBuilderState(), {
            type: "LOAD_WORKOUT",
            workout,
          })
        : createInitialBuilderState()
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    const payload = toBuilderPayload(state);
    const result = validateBuilderPayload(payload, {
      primaryTypeOptions,
      difficultyOptions,
      blockTypeOptions,
      volumeTypeOptions,
      targetTypeOptions,
      targetPresetOptions,
    });

    if (!result.success) {
      setSaveError(result.error);
      return;
    }

    setSaveError(null);
    const response = workoutId
      ? await updateFullWorkout(workoutId, payload)
      : await createFullWorkout(payload);
    if (response?.error) {
      setSaveError(response.error);
    }
  }

  return (
    <form action={handleSave} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium">Workout</legend>

        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            required
            value={state.meta.title}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "title",
                value: e.target.value,
              })
            }
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            value={state.meta.description}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "description",
                value: e.target.value,
              })
            }
            className="rounded-md border border-hairline bg-surface-1 px-4 py-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Primary type
          <select
            required
            value={state.meta.primaryType}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "primaryType",
                value: e.target.value as PrimaryType | "",
              })
            }
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <option value="" disabled>
              Select a type
            </option>
            {primaryTypeOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Difficulty
          <select
            required
            value={state.meta.difficulty}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "difficulty",
                value: e.target.value as Difficulty | "",
              })
            }
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <option value="" disabled>
              Select a difficulty
            </option>
            {difficultyOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Estimated duration in minutes
          <input
            type="number"
            min={1}
            step={5}
            value={state.meta.estimatedDurationMinutes ?? ""}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "estimatedDurationMinutes",
                value: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          Tags
          <div className="flex flex-wrap gap-2">
            {tagCatalog.length === 0 ? (
              <p className="text-sm text-ink-subtle">No tags available.</p>
            ) : (
              tagCatalog.map((tag) => {
                const selected = state.meta.tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      dispatch({ type: "TOGGLE_TAG", tagId: tag.id })
                    }
                    className={`rounded-full border px-3 py-1 text-xs ${
                      selected
                        ? TAG_COLOR_CLASSES[tag.color]
                        : "border-hairline text-ink-subtle hover:border-hairline-strong hover:text-ink"
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-medium">Blocks</legend>

        {state.blocks.length === 0 ? (
          <p className="text-sm text-ink-subtle">No blocks yet.</p>
        ) : (
          state.blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              index={index}
              blockTypeOptions={blockTypeOptions}
              catalog={exerciseCatalog}
              volumeTypeOptions={volumeTypeOptions}
              targetTypeOptions={targetTypeOptions}
              targetPresetOptions={targetPresetOptions}
              unitSystem={unitSystem}
              dispatch={dispatch}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => dispatch({ type: "ADD_BLOCK" })}
          className="flex h-11 items-center justify-center self-start rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Add block
        </button>
      </fieldset>

      {saveError && (
        <p className="rounded border border-danger/40 bg-surface-2 p-2 text-sm text-danger">
          {saveError}
        </p>
      )}

      <SubmitButton className="flex h-11 items-center justify-center self-start rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
        Save
      </SubmitButton>
      <FormPendingBanner />
    </form>
  );
}
