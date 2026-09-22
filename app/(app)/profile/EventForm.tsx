"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { EVENT_TYPES } from "@/db/enums";
import {
  FormErrorMessage,
  FormPendingBanner,
  FormSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import type { Event } from "@/lib/events";
import {
  SHORT_TEXT_MAX_LENGTH,
  LONG_TEXT_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from "@/lib/text-limits";
import Modal from "../_components/Modal";
import { MENU_ITEM_CLASSES } from "../_components/CardMenu";
import { SECTION_BUTTON_CLASSES } from "../_components/section-button";
import { EVENT_TYPE_LABELS } from "./event-labels";
import { addEvent, updateEvent, type EventFormState } from "./events-actions";
import { FIELD_CLASSES_SURFACE_2, ICON_BUTTON_CLASSES_32, SECONDARY_BUTTON_CLASSES_SURFACE_2, SUBMIT_BUTTON_CLASSES } from "../_components/shared-classes";

const initialState: EventFormState = { status: "idle" };

// NextEventCard's empty-state button ("Add an event") — not
// SECTION_BUTTON_CLASSES (the section-footer "Add event" on /profile uses
// that instead): the two differ in more than which file they live in.
// SECTION_BUTTON_CLASSES is full width and text-centred at every
// breakpoint, closing a section the same way regardless of screen size;
// this button is full width only below `sm` and sized to its own text
// (`sm:w-auto`, no `text-center`) from `sm` up, matching every other
// empty-state CTA in /profile (BodyMetricFields, GoalFields,
// PersonalRecordFields).
const CTA_CLASSES =
  "flex h-10 w-full items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto";

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
  /** Only meaningful when `entry` is present: "menu-item" renders "Edit" as
   * a plain full-width text button (CardMenu's MENU_ITEM_CLASSES) instead
   * of the default bordered Pencil icon button — EventsList's mobile
   * CardMenu passes this, same pattern as GoalFields' own triggerVariant. */
  triggerVariant?: "icon" | "menu-item";
  /** Only meaningful when `entry` is absent and `renderTrigger` isn't
   * supplied — which trigger the Add form gets: "section" (the default) is
   * the full-width section-footer "Add event" button; "cta" is the
   * "Add an event" button of NextEventCard's empty state; "none" renders no
   * trigger at all while the instance stays mounted — NextEventCard passes it
   * once an event exists, instead of conditionally rendering (and thereby
   * destroying) the instance itself: this component's
   * `successCount`/FormSuccessBanner state must survive the exact render that
   * flips the card from empty to non-empty, since that's the one save whose
   * own success would otherwise be discarded by unmounting the very instance
   * that just recorded it. A plain string, not a renderTrigger-shaped
   * callback: NextEventCard is a Server Component, and only serializable
   * props (never functions) can cross into a Client Component like this one —
   * the same reason `renderTrigger` itself is documented above as
   * client-caller-only. */
  trigger?: "section" | "cta" | "none";
  /** Where to come back to when this edit moves the event out of the list
   * the form is rendered in — a same-site path (with hash) supplied by the
   * server component that renders the form. Only meaningful with `entry`.
   * The form's own success banner would be unmounted along with the moved
   * event, so an edit that relocates it submits this and the action ends
   * with a redirect back here carrying `?saved=1` (see
   * lib/redirect-back.ts); an edit that leaves the event where it is takes
   * the ordinary in-place path. */
  returnTo?: string;
  /** With `returnTo`: today's date, when the list has an upcoming/past
   * split (/profile) so only an edit that crosses today moves the event.
   * Absent means any date change moves it (Home's day cards, which show one
   * day). */
  today?: string;
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
 * icon-button by default, or a plain "Edit" menu-item button when
 * `triggerVariant="menu-item"` (the row's mobile CardMenu passes this,
 * EventsList's own doc comment on the row markup). "Edit event"/"Save"
 * copy either way, every field's defaultValue seeded from `entry`, and
 * `updateEvent.bind(null, entry.id)` as the form action in place of
 * addEvent — the bound function
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
  triggerVariant = "icon",
  trigger = "section",
  returnTo,
  today,
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

  function submit(formData: FormData) {
    const nextDate = formData.get("eventDate");
    if (entry && returnTo && typeof nextDate === "string" && nextDate !== entry.eventDate) {
      const relocates =
        today === undefined ||
        entry.eventDate >= today !== nextDate >= today;
      if (relocates) formData.set("returnTo", returnTo);
    }
    formAction(formData);
  }

  return (
    <>
      <FormSuccessBanner trigger={successCount} label="Saved" />
      {renderTrigger ? (
        renderTrigger(openFresh)
      ) : entry ? (
        triggerVariant === "menu-item" ? (
          <button type="button" onClick={openFresh} className={MENU_ITEM_CLASSES}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={openFresh}
            aria-label="Edit"
            className={ICON_BUTTON_CLASSES_32}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      ) : trigger === "none" ? null : (
        <button
          type="button"
          onClick={openFresh}
          className={trigger === "cta" ? CTA_CLASSES : SECTION_BUTTON_CLASSES}
        >
          {trigger === "cta" ? "Add an event" : "Add event"}
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit event" : "Add event"}>
        <form key={formKey} action={submit} className="flex flex-col gap-3">
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
              maxLength={NAME_MAX_LENGTH}
              className={FIELD_CLASSES_SURFACE_2}
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
              className={FIELD_CLASSES_SURFACE_2}
            >
              {EVENT_TYPES.map((type) => (
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
              className={FIELD_CLASSES_SURFACE_2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-eventTime`} className="text-xs font-medium text-ink-subtle">
              Time (optional)
            </label>
            <input
              type="time"
              id={`${uid}-eventTime`}
              name="eventTime"
              defaultValue={fieldDefault("eventTime", entry?.eventTime?.slice(0, 5))}
              className={FIELD_CLASSES_SURFACE_2}
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
              maxLength={SHORT_TEXT_MAX_LENGTH}
              className={FIELD_CLASSES_SURFACE_2}
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
              maxLength={LONG_TEXT_MAX_LENGTH}
              className={FIELD_CLASSES_SURFACE_2}
            />
          </div>

          <FormErrorMessage
            error={visibleState.status === "error" ? visibleState.error : null}
          />

          <div className="mt-1 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={SECONDARY_BUTTON_CLASSES_SURFACE_2}
            >
              Cancel
            </button>
            <SubmitButton className={SUBMIT_BUTTON_CLASSES}>
              {entry ? "Save" : "Add event"}
            </SubmitButton>
          </div>
          <FormPendingBanner label="Saving…" />
        </form>
      </Modal>
    </>
  );
}
