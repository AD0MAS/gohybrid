"use client";

import { useActionState, useState } from "react";
import {
  FormErrorMessage,
  FormPendingBanner,
  FormSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import { SCHEDULE_NOTES_MAX_LENGTH } from "@/lib/text-limits";
import { rescheduleWorkout } from "../upcoming-actions";
import { scheduleWorkout, type ScheduleFormState } from "../workouts/actions";
import { MENU_ITEM_CLASSES } from "./CardMenu";
import Modal from "./Modal";

type ScheduleEntry = {
  id: string;
  scheduledDate: string;
  scheduledTime: string | null;
  notes: string | null;
};

type ScheduleWorkoutFormProps = {
  /** YYYY-MM-DD, the caller's own already-resolved getUserContext `today` —
   * sets the date input's `min`, so the browser greys out every day before
   * it. A convenience only: validateScheduleInput (shared by
   * scheduleWorkout/rescheduleWorkout and the REST routes) still rejects a
   * past date server-side regardless of what the input allowed, since the
   * REST routes never see this input at all — and it also rejects an
   * already-elapsed time on today itself, a constraint the date input's
   * `min` can't express (a time input has no equivalent "only when the date
   * is also today" attribute), so the inline error is the only gate for
   * that case. Required, not defaulted, same reasoning as `today`
   * everywhere else in this codebase — a caller that forgets to resolve and
   * pass it is a compile error. */
  today: string;
} & (
  | {
      /** Creates a new plan for this workout, bound to scheduleWorkout. */
      workoutId: string;
      entry?: never;
      triggerVariant?: "button" | "menu-item";
      /** Only meaningful with `triggerVariant="button"`: overrides
       * BUTTON_TRIGGER_CLASSES below. Home's TODAY card passes its own
       * secondary-button treatment (matching /profile's own h-11
       * bordered "Settings" link, the app's established pairing beside an
       * h-11 accent button) so Reschedule reads as the same size/weight as
       * the rest of that card's row, without touching the workout detail
       * page's own larger button, which stays on the default. */
      triggerClassName?: string;
      returnTo?: never;
    }
  | {
      /** Reschedules this existing entry instead, bound to
       * rescheduleWorkout.bind(null, entry.id) — the fields, validation and
       * digit limits are identical to the create case, only the target
       * action and the field defaults differ. */
      entry: ScheduleEntry;
      workoutId?: never;
      triggerVariant?: "button" | "menu-item";
      /** See the sibling branch's own doc comment. */
      triggerClassName?: string;
      /** The Home view to come back to when the new date moves the entry off
       * the day (or off TODAY) this form is rendered in. A same-site path
       * supplied by the Server Component that renders the form: the form's
       * own "Rescheduled" banner would be unmounted along with the moved
       * entry, so a date change submits this and rescheduleWorkout ends with
       * a redirect back here carrying `?saved=rescheduled` (see
       * lib/redirect-back.ts). A time- or notes-only change stays in place
       * and takes the ordinary path. */
      returnTo?: string;
    }
);

const initialState: ScheduleFormState = { status: "idle" };

// The workout detail page's existing bordered secondary-button look —
// unchanged from before this component moved here.
const BUTTON_TRIGGER_CLASSES =
  "flex h-12 items-center justify-center rounded-control border border-hairline bg-surface-1 px-6 text-base font-medium text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/**
 * "Schedule"/"Reschedule" control: a modal over the same date/time/notes
 * fields, opened from a trigger whose look depends on where it's used — the
 * workout detail page's and Home's TODAY card's primary action row
 * (`triggerVariant="button"`, the default), or a row inside a CardMenu
 * popover (`triggerVariant="menu-item"`, CardMenu's own MENU_ITEM_CLASSES —
 * the week strip's day-card menu uses this one for Reschedule, same
 * reasoning as GoalFields' own `triggerVariant="menu-item"`). `workoutId`
 * binds
 * scheduleWorkout for a brand-new plan; `entry` binds rescheduleWorkout
 * against an existing one instead and seeds every field from it — exactly
 * the entry/renderTrigger-less half of EventForm's own create-vs-edit
 * pattern (app/(app)/profile/EventForm.tsx), which this mirrors closely
 * enough that its doc comment is worth reading for the parts not repeated
 * here.
 *
 * Uses useActionState rather than useTransition + try/catch: a validation
 * failure from scheduleWorkout/rescheduleWorkout (including the past-date
 * rule both share via validateScheduleInput) is an expected outcome of a
 * form submission, so it comes back as { status: "error", error } to render
 * inline instead of throwing into app/error.tsx. The modal closes only once
 * the state actually reaches "success" — the comparison is `state !==
 * prevState` (object identity) done during render, not in a useEffect,
 * because both actions return a fresh object literal on every call —
 * comparing `.status` alone would miss two consecutive successful
 * submissions.
 *
 * A failed submit restores exactly what the user typed via the same
 * mechanism as EventForm/GoalFields: `formKey` remounts the `<form>` on
 * every error, and `fieldDefault`, reading the action's echoed `values`,
 * supplies each plain uncontrolled field's defaultValue — falling back to
 * `entry`'s original value when rescheduling, or nothing when scheduling
 * fresh. Every field here is uncontrolled, so unlike PersonalRecordFields/
 * GoalFields/BodyMetricFields this file needs no split into a separately
 * keyed inner component.
 *
 * `openFresh` (the trigger button's handler) also bumps `formKey`, on top of
 * the existing error-triggered bump — reopening must show `entry`'s current
 * values (or a blank form when scheduling), not whatever was last typed and
 * abandoned (Esc, the X, a backdrop click: none of those submit the form,
 * so nothing about a stale, uncorrected attempt gets cleared on its own).
 * `errorActive` tracks whether `state`'s error, if any, still belongs to the
 * session that's open right now, or is left over from one dismissed without
 * fixing — without it, `submitted` would still read that stale
 * `state.status === "error"` on reopen and hand the form its abandoned
 * values instead of `entry`'s. `visibleState` is the real error while
 * `errorActive`, and `initialState` otherwise, and every other read below is
 * written against it instead of the raw `state` from useActionState (which
 * stays untouched, so the sync block above can still tell success/error
 * apart by identity).
 */
export default function ScheduleWorkoutForm({
  today,
  workoutId,
  entry,
  triggerVariant = "button",
  triggerClassName,
  returnTo,
}: ScheduleWorkoutFormProps) {
  const [open, setOpen] = useState(false);
  const action = entry
    ? rescheduleWorkout.bind(null, entry.id)
    : scheduleWorkout.bind(null, workoutId);
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
  const visibleState: ScheduleFormState = errorActive ? state : initialState;
  const submitted = visibleState.status === "error" ? visibleState.values : null;
  function fieldDefault(name: string, fallback?: string): string | undefined {
    return submitted?.[name] ?? fallback;
  }

  function openFresh() {
    setFormKey((key) => key + 1);
    setErrorActive(false);
    setOpen(true);
  }

  function submit(formData: FormData) {
    if (entry && returnTo && formData.get("scheduledDate") !== entry.scheduledDate) {
      formData.set("returnTo", returnTo);
    }
    formAction(formData);
  }

  return (
    <>
      <FormSuccessBanner
        trigger={successCount}
        label={entry ? "Rescheduled" : "Scheduled"}
      />
      <button
        type="button"
        onClick={openFresh}
        className={
          triggerVariant === "menu-item"
            ? MENU_ITEM_CLASSES
            : (triggerClassName ?? BUTTON_TRIGGER_CLASSES)
        }
      >
        {entry ? "Reschedule" : "Schedule"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={entry ? "Reschedule this workout" : "Schedule this workout"}
      >
        <form key={formKey} action={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input
              type="date"
              name="scheduledDate"
              defaultValue={fieldDefault("scheduledDate", entry?.scheduledDate)}
              min={today}
              required
              className="h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Time (optional)
            <input
              type="time"
              name="scheduledTime"
              defaultValue={fieldDefault(
                "scheduledTime",
                entry?.scheduledTime?.slice(0, 5)
              )}
              className="h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Notes (optional)
            <input
              type="text"
              name="notes"
              defaultValue={fieldDefault("notes", entry?.notes ?? "")}
              maxLength={SCHEDULE_NOTES_MAX_LENGTH}
              className="h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <FormErrorMessage
            error={visibleState.status === "error" ? visibleState.error : null}
          />

          <SubmitButton className="flex h-11 items-center justify-center self-start rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
            {entry ? "Save" : "Schedule"}
          </SubmitButton>
          <FormPendingBanner label={entry ? "Rescheduling…" : "Scheduling…"} />
        </form>
      </Modal>
    </>
  );
}
