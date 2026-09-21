"use client";

import { useActionState, useState } from "react";
import {
  FormErrorMessage,
  FormPendingBanner,
  FormSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import {
  logPastSession,
  type LogPastSessionFormState,
} from "../workouts/actions";
import Modal from "./Modal";
import WorkoutPicker from "./WorkoutPicker";

type LogPastSessionFormProps = {
  /** YYYY-MM-DD, the caller's own already-resolved getUserContext `today` —
   * sets the date input's `max`, so the browser greys out every future day.
   * A convenience only: validateLogPastSessionInput still rejects a future
   * date server-side, and rejects today itself unless a time earlier than
   * `now` is also given — a constraint the `max` attribute alone can't
   * express, so the inline error still does the real gatekeeping for that
   * case. */
  today: string;
  /** Overrides BUTTON_TRIGGER_CLASSES below. Home's Quick Actions passes
   * SECTION_BUTTON_CLASSES so this button matches its sibling section
   * buttons, without touching the workout detail page's own larger button,
   * which stays on the default. */
  triggerClassName?: string;
} & (
  | { workoutId: string; workouts?: never }
  | { workoutId?: never; workouts: readonly { id: string; title: string }[] }
);

const initialState: LogPastSessionFormState = { status: "idle" };

// Matches ScheduleWorkoutForm's own detail-page button look — the two sit
// side by side in the workout detail page's primary action row.
const BUTTON_TRIGGER_CLASSES =
  "flex h-12 items-center justify-center rounded-control border border-hairline bg-surface-1 px-6 text-base font-medium text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/**
 * "Log a past session" control: creates a completed session for a chosen
 * workout at a chosen date and time no later than now, via logPastSession
 * (app/(app)/workouts/actions.ts) — for a workout done before this app ever
 * recorded it, as opposed to Start Workout Mode's Finish or the week strip's
 * Mark done, both of which know the real completion instant. A past date
 * needs no time; today needs one that is now or earlier, or the server
 * rejects it — see logPastSession's own doc comment for the exact rule and
 * why today (with a time) is allowed at all.
 *
 * `workoutId` known — the /workouts/[id] entry point — renders it as a hidden
 * field. `workouts` — Home's Quick actions entry point — renders
 * WorkoutPicker instead, so the user names the workout themselves. Either way `workoutId` travels as a plain FormData
 * field the one action reads (see logPastSession's own doc comment for why
 * it's never a bound argument here, unlike scheduleWorkout).
 *
 * Otherwise the same shape as ScheduleWorkoutForm
 * (app/(app)/_components/ScheduleWorkoutForm.tsx): useActionState renders a
 * validation failure inline instead of throwing into app/error.tsx, the
 * modal closes only once state reaches "success" (an object-identity
 * comparison done during render, not a useEffect, since logPastSession
 * returns a fresh object literal on every call), and a failed submit
 * restores what was typed via formKey remounting the form plus fieldDefault
 * reading the echoed values back.
 */
export default function LogPastSessionForm({
  today,
  workoutId,
  workouts,
  triggerClassName,
}: LogPastSessionFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(logPastSession, initialState);
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
  const visibleState: LogPastSessionFormState = errorActive
    ? state
    : initialState;
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
      <FormSuccessBanner trigger={successCount} label="Logged" />
      <button
        type="button"
        onClick={openFresh}
        className={triggerClassName ?? BUTTON_TRIGGER_CLASSES}
      >
        Log a past session
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log a past session"
      >
        <form key={formKey} action={formAction} className="flex flex-col gap-3">
          {workoutId ? (
            <input type="hidden" name="workoutId" value={workoutId} />
          ) : (
            <WorkoutPicker
              workouts={workouts ?? []}
              defaultValue={fieldDefault("workoutId")}
            />
          )}

          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              name="date"
              defaultValue={fieldDefault("date")}
              max={today}
              required
              className="h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Time (optional)
            <input
              type="time"
              name="time"
              defaultValue={fieldDefault("time")}
              className="h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <FormErrorMessage
            error={visibleState.status === "error" ? visibleState.error : null}
          />

          <SubmitButton className="flex h-11 items-center justify-center self-start rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
            Log session
          </SubmitButton>
          <FormPendingBanner label="Logging…" />
        </form>
      </Modal>
    </>
  );
}
