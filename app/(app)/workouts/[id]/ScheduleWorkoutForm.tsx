"use client";

import { useActionState, useState } from "react";
import { FormPendingBanner, FormSuccessBanner, SubmitButton } from "@/app/_components/FormStatus";
import Modal from "../../_components/Modal";
import type { ScheduleFormState } from "../actions";

type ScheduleWorkoutFormProps = {
  scheduleAction: (
    prevState: ScheduleFormState,
    formData: FormData
  ) => Promise<ScheduleFormState>;
};

const initialState: ScheduleFormState = { status: "idle" };

/**
 * "Schedule" control on the workout detail page: a secondary button in the
 * primary action row that opens the date/time/notes form in a centred Modal
 * (app/(app)/_components/Modal.tsx) — the workout id is already baked into
 * `scheduleAction` via .bind(null, id) from the (Server Component) page,
 * mirroring FavoriteToggle and DeleteWorkoutModal.
 *
 * Uses useActionState rather than useTransition + try/catch: a validation
 * failure from scheduleWorkout is an expected outcome of a form submission,
 * so it comes back as { status: "error", error } to render inline instead
 * of throwing into app/error.tsx. The modal closes only once the state
 * actually reaches "success" — same pattern, and same reasoning, as the
 * /profile *Fields components (see BodyMetricFields): the comparison is
 * `state !== prevState` (object identity) done during render, not in a
 * useEffect, because scheduleWorkout returns a fresh object literal on
 * every call — comparing `.status` alone would miss two consecutive
 * successful submissions.
 *
 * A failed submit restores exactly what the user typed via the same
 * mechanism as GoalFields (see its doc comment for the full explanation):
 * `formKey` remounts the `<form>` on every error, and `fieldDefault`,
 * reading scheduleWorkout's echoed `values`, supplies each plain
 * uncontrolled field's defaultValue — there's no `entry` here (a schedule
 * form always starts blank), so the fallback is simply undefined. Every
 * field here is uncontrolled, so unlike PersonalRecordFields/GoalFields/
 * BodyMetricFields this file needs no split into a separately keyed inner
 * component — remounting the `<form>` itself is enough.
 *
 * `openFresh` (the trigger button's handler) also bumps `formKey`, on top
 * of the existing error-triggered bump — reopening must show a blank form,
 * not whatever date/time/notes was last typed and abandoned (Esc, the X, a
 * backdrop click: none of those submit the form, so nothing about a stale,
 * uncorrected attempt gets cleared on its own). `errorActive` tracks
 * whether `state`'s error, if any, still belongs to the session that's open
 * right now, or is left over from one dismissed without fixing — without
 * it, `submitted` would still read that stale `state.status === "error"` on
 * reopen and hand the form its abandoned values instead of a blank one.
 * `visibleState` is the real error while `errorActive`, and `initialState`
 * otherwise, and every other read below is written against it instead of
 * the raw `state` from useActionState (which stays untouched, so the sync
 * block above can still tell success/error apart by identity).
 */
export default function ScheduleWorkoutForm({
  scheduleAction,
}: ScheduleWorkoutFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(scheduleAction, initialState);
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
  const visibleState: ScheduleFormState = errorActive ? state : initialState;
  const submitted = visibleState.status === "error" ? visibleState.values : null;
  function fieldDefault(name: string): string | undefined {
    return submitted?.[name];
  }

  function openFresh() {
    setFormKey((key) => key + 1);
    setErrorActive(false);
    setOpen(true);
  }

  return (
    <>
      <FormSuccessBanner trigger={successCount} />
      <button
        type="button"
        onClick={openFresh}
        className="flex h-12 items-center justify-center rounded-md border border-hairline bg-surface-1 px-6 text-base font-medium text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        Schedule
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule this workout"
      >
        <form key={formKey} action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              name="scheduledDate"
              defaultValue={fieldDefault("scheduledDate")}
              required
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Time (optional)
            <input
              type="time"
              name="scheduledTime"
              defaultValue={fieldDefault("scheduledTime")}
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Notes (optional)
            <input
              type="text"
              name="notes"
              defaultValue={fieldDefault("notes")}
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          {visibleState.status === "error" && (
            <p className="text-sm text-danger">{visibleState.error}</p>
          )}

          <SubmitButton className="flex h-11 items-center justify-center self-start rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
            Schedule
          </SubmitButton>
          <FormPendingBanner />
        </form>
      </Modal>
    </>
  );
}
