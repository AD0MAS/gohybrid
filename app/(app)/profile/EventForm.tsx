"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { eventTypeEnum } from "@/db/schema";
import type { Event } from "@/lib/events";
import Modal from "../_components/Modal";
import { EVENT_TYPE_LABELS } from "./event-labels";
import { addEvent, updateEvent, type EventFormState } from "./events-actions";

const initialState: EventFormState = { status: "idle" };

type EventFormProps = {
  /** Absent renders the Add-event button + form; present renders a Pencil
   * edit trigger + the same form pre-filled from this event, submitting to
   * updateEvent instead of addEvent. */
  entry?: Event;
};

/**
 * The add-event form as a client component, needed for useActionState: a
 * validation failure from addEvent renders here as { status: "error",
 * error } above the submit button instead of throwing into app/error.tsx,
 * and the user's input stays put since nothing unmounts. Unlike
 * BodyMetricFields/GoalFields, this needs no server-fetched data (no
 * catalog, and no min/max on the date input — an event's date is
 * deliberately unconstrained in both directions, see
 * lib/events-validation.ts), so there's no Server Component wrapper
 * fetching props for it.
 *
 * The form itself lives inside a Modal, opened by the button rendered
 * alongside it: `open` is local state, closed only once addEvent's state
 * actually reaches "success" — an error leaves it open so the user can
 * fix and resubmit without retyping. That close is done during render
 * (comparing the state object's identity against prevState), not in a
 * useEffect, since setState in an effect just to react to another piece
 * of React state is the pattern React's own docs steer away from in
 * favour of adjusting state directly while rendering. The comparison uses
 * `state !== prevState` — object identity, not `state.status !==
 * prevStatus` — because addEvent returns a fresh object literal on every
 * call: comparing only the `.status` string would miss two consecutive
 * identical statuses (e.g. a second successful submission right after the
 * first), since "success" === "success" leaves the check unable to tell
 * "still the old result" from "a new result that happens to match."
 *
 * When `entry` is present, this same component renders as EventsList's
 * per-row edit trigger instead of the section's Add button: a Pencil
 * icon-button in place of the Plus button, "Edit event"/"Save" copy, every
 * field's defaultValue seeded from `entry`, and `updateEvent.bind(null,
 * entry.id)` as the form action in place of addEvent — the bound function
 * still matches useActionState's (prevState, formData) signature. No unit
 * conversion is needed here (unlike Goal/BodyMetric/PersonalRecord
 * editing) since an event carries no numeric, unit-bearing field.
 *
 * A failed submit restores exactly what the user typed via the same
 * mechanism as GoalFields (see its doc comment for the full explanation):
 * `formKey` remounts the `<form>` on every error — needed here more than
 * anywhere else, since every field in this form (including eventType,
 * unlike Goal/PersonalRecord/BodyMetric's controlled selects) is plain
 * uncontrolled `defaultValue` — and `fieldDefault`, reading
 * addEvent/updateEvent's echoed `values`, supplies each field's defaultValue
 * in preference to `entry`'s original value.
 */
export default function EventForm({ entry }: EventFormProps) {
  const [open, setOpen] = useState(false);
  const action = entry ? updateEvent.bind(null, entry.id) : addEvent;
  const [state, formAction] = useActionState(action, initialState);
  const [prevState, setPrevState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setOpen(false);
    else if (state.status === "error") setFormKey((key) => key + 1);
  }
  const submitted = state.status === "error" ? state.values : null;
  function fieldDefault(name: string, fallback?: string): string | undefined {
    return submitted?.[name] ?? fallback;
  }

  return (
    <>
      {entry ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Plus className="h-4 w-4" />
          Add event
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit event" : "Add event"}>
        <form key={formKey} action={formAction} className="flex flex-col gap-3">
          <input
            type="text"
            name="title"
            placeholder="Event title"
            defaultValue={fieldDefault("title", entry?.title)}
            required
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <select
            name="eventType"
            defaultValue={fieldDefault("eventType", entry?.eventType ?? "race")}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {eventTypeEnum.enumValues.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type].label}
              </option>
            ))}
          </select>

          <input
            type="date"
            name="eventDate"
            defaultValue={fieldDefault("eventDate", entry?.eventDate)}
            required
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <input
            type="text"
            name="location"
            placeholder="Location (optional)"
            defaultValue={fieldDefault("location", entry?.location ?? "")}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <input
            type="text"
            name="notes"
            placeholder="Notes (optional)"
            defaultValue={fieldDefault("notes", entry?.notes ?? "")}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          {state.status === "error" && (
            <p className="text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {entry ? "Save" : "Add event"}
          </button>
        </form>
      </Modal>
    </>
  );
}
