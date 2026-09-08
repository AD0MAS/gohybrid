"use client";

import { useReducer, useState } from "react";
import type { unitSystemEnum } from "@/db/schema";
import { PendingBanner, PendingSubmitButton } from "@/app/_components/FormStatus";
import { DURATION_MINUTES_DIGIT_LIMIT } from "@/lib/numeric-limits";
import {
  WORKOUT_DESCRIPTION_MAX_LENGTH,
  WORKOUT_TITLE_MAX_LENGTH,
} from "@/lib/text-limits";
import { validateBuilderPayload } from "@/lib/workout-builder-validation";
import { DIFFICULTY_LABELS } from "../difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "../primary-type-labels";
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
import {
  numberInputGuardProps,
  sanitizeNumberInputChange,
} from "../../_components/sanitize-live-number";

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
 * The whole tree is wrapped in a <form onSubmit={...}> (rather than a plain
 * <div> with an onClick'd Save button) purely for semantics and so pressing
 * Enter in a text field submits — not a React 19 Action: every field here
 * is controlled via the reducer and none of them carry a `name`, so
 * FormData has nothing to read, and `action={handleSave}` was tried and
 * reverted — React calls the native form.reset() as the last DOM operation
 * of every Action's commit (success or failure), which silently wiped
 * controlled inputs on a failed save even though the reducer state was
 * untouched. onSubmit only calls preventDefault + handleSave, so no such
 * reset ever runs. Pending state is therefore a plain `isSaving` state
 * variable instead of useFormStatus (which only reports on a <form
 * action={...}>) — see PendingBanner/PendingSubmitButton (app/_components/
 * FormStatus.tsx), the prop-driven counterparts to FormPendingBanner/
 * SubmitButton kept for this reason. No BlockEditor/ItemEditor button is
 * `type="submit"`, so pressing Enter in a text field is the only other way
 * to trigger it. No FormSuccessBanner: both
 * createFullWorkout and updateFullWorkout redirect() on success, so this
 * component unmounts before any success state could render — same
 * reasoning as SettingsFields. The workout detail page shows the success
 * confirmation instead, via RedirectSuccessBanner reading the `?saved=1`
 * both actions append to their redirect target (see app/_components/
 * FormStatus.tsx and workouts/[id]/page.tsx).
 *
 * `noValidate` on the <form> is required, not cosmetic: BlockEditor's Rounds
 * input is natively `required` for on_off/emom, and Modal never unmounts a
 * closed block's fields (see Modal.tsx) — it only hides them via the native
 * dialog:not([open]) { display: none } rule. A `required`-and-empty field
 * that becomes unrenderable this way is still a submission candidate per
 * the HTML spec (display:none isn't one of the listed bar-from-validation
 * reasons), but isn't focusable either, so the browser silently aborts the
 * submit event instead of showing its usual validation bubble — handleSave
 * never runs, and whatever saveError was already on screen just sits there
 * unchanged, looking exactly like a stale error message. `noValidate`
 * removes native constraint validation from the picture entirely, leaving
 * validateBuilderPayload as the only thing that ever decides whether Save
 * succeeds — which was already the intent (see above).
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
  const [isSaving, setIsSaving] = useState(false);
  /** The most recently ADD_BLOCK-ed block's id, so that block's
   * BlockEditor can auto-open its modal once. Generated here (not by the
   * reducer) so it's known in the same tick as the dispatch — see
   * AddBlockAction's doc comment in reducer.ts. */
  const [lastAddedBlockId, setLastAddedBlockId] = useState<string | null>(null);
  /** Derived from exerciseCatalog rather than threaded down as its own
   * prop — every caller of validateBuilderPayload/validateBuilderItemDraft
   * computes restExerciseIds from a catalog it already has (see
   * BuilderEnumOptions' own doc comment). */
  const restExerciseIds = exerciseCatalog
    .filter((exercise) => exercise.category === "rest")
    .map((exercise) => exercise.id);

  /** Clears saveError up front, before validation runs, rather than only
   * ever overwriting it in the failure branch below — belt-and-braces
   * alongside the <form>'s `noValidate` above, so a message from a
   * previous attempt can never survive a run that produces no message of
   * its own. */
  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    const payload = toBuilderPayload(state);
    const result = validateBuilderPayload(payload, {
      primaryTypeOptions,
      difficultyOptions,
      blockTypeOptions,
      volumeTypeOptions,
      targetTypeOptions,
      targetPresetOptions,
      restExerciseIds,
    });

    if (!result.success) {
      setSaveError(result.error);
      setIsSaving(false);
      return;
    }

    const response = workoutId
      ? await updateFullWorkout(workoutId, payload)
      : await createFullWorkout(payload);
    if (response?.error) {
      setSaveError(response.error);
      setIsSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium">Workout</legend>

        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            required
            maxLength={WORKOUT_TITLE_MAX_LENGTH}
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
          <span className="flex items-center gap-1">
            Description<span className="text-xs text-ink-subtle">(optional)</span>
          </span>
          <textarea
            maxLength={WORKOUT_DESCRIPTION_MAX_LENGTH}
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
                {PRIMARY_TYPE_LABELS[value].label}
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
                {DIFFICULTY_LABELS[value].label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1">
            Estimated duration in minutes
            <span className="text-xs text-ink-subtle">(optional)</span>
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={state.meta.estimatedDurationMinutes ?? ""}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "estimatedDurationMinutes",
                // Same DURATION_MINUTES_DIGIT_LIMIT
                // validateBuilderPayload checks this field against.
                value: sanitizeNumberInputChange(e, {
                  min: 1,
                  digitLimit: DURATION_MINUTES_DIGIT_LIMIT,
                }),
              })
            }
            {...numberInputGuardProps()}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1">
            Tags<span className="text-xs text-ink-subtle">(optional)</span>
          </span>
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
                        : "border-hairline text-ink-subtle hover:border-hairline-strong hover:text-ink active:border-hairline-strong active:text-ink"
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
              autoOpen={block.id === lastAddedBlockId}
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
          onClick={() => {
            const id = crypto.randomUUID();
            setLastAddedBlockId(id);
            dispatch({ type: "ADD_BLOCK", id });
          }}
          className="flex h-11 items-center justify-center self-start rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Add block
        </button>
      </fieldset>

      {saveError && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-surface-2 p-2 text-sm text-danger"
        >
          {saveError}
        </p>
      )}

      <PendingSubmitButton
        pending={isSaving}
        className="flex h-11 items-center justify-center self-start rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        Save
      </PendingSubmitButton>
      <PendingBanner pending={isSaving} label="Saving…" />
    </form>
  );
}
