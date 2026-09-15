"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { eventTypeEnum } from "@/db/schema";
import {
  FormErrorMessage,
  FormPendingBanner,
  FormSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import type { Event } from "@/lib/events";
import {
  EVENT_LOCATION_MAX_LENGTH,
  EVENT_NOTES_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
} from "@/lib/text-limits";
import Modal from "../_components/Modal";
import { EVENT_TYPE_LABELS } from "./event-labels";
import { addEvent, updateEvent, type EventFormState } from "./events-actions";

const initialState: EventFormState = { status: "idle" };

// w-full sm:w-auto matches GoalFields' own empty-state button ("Set your
// first goal") — every empty-state CTA in /profile spans the full panel
// width below sm and sizes to its own text from sm up.
const CTA_CLASSES =
  "flex h-10 w-full items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto";

// The section heading's own trigger, rebuilt from BodyMetricTypeTabs' own tab
// button (the closest existing "small secondary button inside a panel"):
// rounded-control, border, px-4 py-1.5 (this is what gives the height — no
// separate h-* class, same as the tabs), text-xs font-medium, and the same
// focus ring, copied as-is. Two deliberate departures from an inactive tab:
// bg-surface-2 (the panel behind it is bg-surface-1 — one step darker — so
// surface-2 is one step lighter, same value the tabs already rest at, chosen
// so the button reads as raised rather than an outlined hole) with text-ink
// rather than text-ink-subtle, since this is the section's one primary
// action and should carry more visual weight than an inactive tab's muted
// label. hover:/active: reuse the tabs' own *active-tab* values
// (border-hairline-strong, bg-surface-3) as the pressed/hovered state — the
// same transition the tabs already define between their two states, just
// triggered by a pseudo-class instead of a click, and active: mirrors hover:
// per the app-wide touch-feedback convention (see globals.css/CLAUDE.md).
const HEADER_TRIGGER_CLASSES =
  "rounded-control border border-hairline bg-surface-2 px-4 py-1.5 text-xs font-medium text-ink hover:border-hairline-strong hover:bg-surface-3 active:border-hairline-strong active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

type EventFormProps = {
  /** Absent renders the Add-event button + form; present renders a Pencil
   * edit trigger + the same form pre-filled from this event, submitting to
   * updateEvent instead of addEvent. */
  entry?: Event;
  /** Replaces the built-in Pencil/Add-event trigger button with a
   * caller-supplied element — e.g. EventCard's whole card
   * (app/(app)/_components/EventCard.tsx), made clickable the same
   * stretched-link way workout cards are (see its own doc comment). Only
   * ever passed by a client-component caller — a function prop can't cross
   * from a Server Component into EventForm (a "use client" boundary), so a
   * Server Component wanting a custom trigger must render a client
   * component of its own that calls this, rather than passing renderTrigger
   * itself. Called with `openFresh` rather than the raw setter, so a
   * caller-supplied trigger reseeds the form from `entry` fresh on every
   * open exactly like the built-in Pencil button does. */
  renderTrigger?: (open: () => void) => ReactNode;
  /** Only meaningful when `entry` is absent and `renderTrigger` isn't
   * supplied: renders the default Add-event trigger as a full CTA button
   * with this label instead of the quiet header-style text link —
   * EventsList's empty state passes "Add an event". A plain string, not a
   * second renderTrigger-shaped callback: EventsList, which needs this
   * variant, is a Server Component, and only serializable props (never
   * functions) can cross into a Client Component like this one — the same
   * reason `renderTrigger` itself is documented above as client-caller-only. */
  ctaLabel?: string;
  /** Only meaningful when `ctaLabel` is also set: hides the CTA button
   * itself via `hidden` (display: none) without unmounting this component
   * — EventsList's hero instance passes this once an event exists, instead
   * of EventsList conditionally rendering (and thereby destroying) the
   * instance itself. See EventsList's own doc comment for why: this
   * component's `successCount`/FormSuccessBanner state must survive the
   * exact render that flips the section from empty to non-empty, since
   * that's the one save whose own success would otherwise be discarded by
   * unmounting the very instance that just recorded it. */
  hidden?: boolean;
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
 * in preference to `entry`'s original value. Since every field here is
 * uncontrolled, this file needs no PersonalRecordFields/GoalFields/
 * BodyMetricFields-style split into a separately keyed inner component —
 * remounting the `<form>` itself is enough, there's no controlled
 * useState-driven select whose value would survive that remount untouched.
 *
 * `openFresh` (the trigger buttons' handler) also bumps `formKey`, on top
 * of the existing error-triggered bump — reopening must show `entry` fresh,
 * not whatever was last typed and abandoned (Esc, the X, a backdrop click:
 * none of those submit the form, so nothing about a stale, uncorrected
 * attempt gets cleared on its own). `errorActive` tracks whether `state`'s
 * error, if any, still belongs to the session that's open right now, or is
 * left over from one dismissed without fixing — without it, `submitted`
 * would still read that stale `state.status === "error"` on reopen and
 * hand the form its abandoned values instead of `entry`'s. `visibleState`
 * is the real error while `errorActive`, and `initialState` otherwise, and
 * every other read below is written against it instead of the raw `state`
 * from useActionState (which stays untouched, so the sync block above can
 * still tell success/error apart by identity).
 */
export default function EventForm({
  entry,
  renderTrigger,
  ctaLabel,
  hidden = false,
}: EventFormProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const action = entry ? updateEvent.bind(null, entry.id) : addEvent;
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
  const visibleState: EventFormState = errorActive ? state : initialState;
  const submitted = visibleState.status === "error" ? visibleState.values : null;
  function fieldDefault(name: string, fallback?: string): string | undefined {
    return submitted?.[name] ?? fallback;
  }

  function openFresh() {
    setFormKey((key) => key + 1);
    setErrorActive(false);
    setOpen(true);
  }

  return (
    <>
      <FormSuccessBanner trigger={successCount} label="Saved" />
      {renderTrigger ? (
        renderTrigger(openFresh)
      ) : entry ? (
        <button
          type="button"
          onClick={openFresh}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-small border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : ctaLabel ? (
        // Swaps the whole className rather than adding a `hidden` attribute
        // alongside CTA_CLASSES' own `flex` — see GoalFields' matching
        // button for why: `flex` is author-origin and would beat the
        // user-agent-origin `[hidden]` rule regardless of order.
        <button
          type="button"
          onClick={openFresh}
          className={hidden ? "hidden" : CTA_CLASSES}
        >
          {ctaLabel}
        </button>
      ) : (
        <button type="button" onClick={openFresh} className={HEADER_TRIGGER_CLASSES}>
          Add event
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit event" : "Add event"}>
        <form key={formKey} action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-title`} className="text-xs font-medium text-ink-subtle">
              Title
            </label>
            <input
              type="text"
              id={`${uid}-title`}
              name="title"
              placeholder="Event title"
              defaultValue={fieldDefault("title", entry?.title)}
              required
              maxLength={EVENT_TITLE_MAX_LENGTH}
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-eventType`} className="text-xs font-medium text-ink-subtle">
              Event type
            </label>
            <select
              id={`${uid}-eventType`}
              name="eventType"
              defaultValue={fieldDefault("eventType", entry?.eventType ?? "race")}
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              {eventTypeEnum.enumValues.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-eventDate`} className="text-xs font-medium text-ink-subtle">
              Date
            </label>
            <input
              type="date"
              id={`${uid}-eventDate`}
              name="eventDate"
              defaultValue={fieldDefault("eventDate", entry?.eventDate)}
              required
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-location`} className="text-xs font-medium text-ink-subtle">
              Location (optional)
            </label>
            <input
              type="text"
              id={`${uid}-location`}
              name="location"
              placeholder="Location (optional)"
              defaultValue={fieldDefault("location", entry?.location ?? "")}
              maxLength={EVENT_LOCATION_MAX_LENGTH}
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-notes`} className="text-xs font-medium text-ink-subtle">
              Notes (optional)
            </label>
            <input
              type="text"
              id={`${uid}-notes`}
              name="notes"
              placeholder="Notes (optional)"
              defaultValue={fieldDefault("notes", entry?.notes ?? "")}
              maxLength={EVENT_NOTES_MAX_LENGTH}
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </div>

          <FormErrorMessage
            error={visibleState.status === "error" ? visibleState.error : null}
          />

          <div className="mt-1 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-base text-ink hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              Cancel
            </button>
            <SubmitButton className="flex h-11 items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
              {entry ? "Save" : "Add event"}
            </SubmitButton>
          </div>
          <FormPendingBanner label="Saving…" />
        </form>
      </Modal>
    </>
  );
}
