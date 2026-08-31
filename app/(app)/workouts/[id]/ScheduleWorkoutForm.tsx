"use client";

import { useActionState, useState } from "react";
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
 * form always starts blank), so the fallback is simply undefined.
 */
export default function ScheduleWorkoutForm({
  scheduleAction,
}: ScheduleWorkoutFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(scheduleAction, initialState);
  const [prevState, setPrevState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setOpen(false);
    else if (state.status === "error") setFormKey((key) => key + 1);
  }
  const submitted = state.status === "error" ? state.values : null;
  function fieldDefault(name: string): string | undefined {
    return submitted?.[name];
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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

          {state.status === "error" && (
            <p className="text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            className="flex h-11 items-center justify-center self-start rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Schedule
          </button>
        </form>
      </Modal>
    </>
  );
}
