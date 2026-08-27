"use client";

import { useActionState } from "react";
import { eventTypeEnum } from "@/db/schema";
import { EVENT_TYPE_LABELS } from "./event-labels";
import { addEvent, type EventFormState } from "./events-actions";

const initialState: EventFormState = { error: null };

/**
 * The add-event form as a client component, needed for useActionState: a
 * validation failure from addEvent renders here as { error } above the
 * submit button instead of throwing into app/error.tsx, and the user's
 * input stays put since nothing unmounts. Unlike BodyMetricFields/
 * GoalFields, this needs no server-fetched data (no catalog, and no
 * min/max on the date input — an event's date is deliberately
 * unconstrained in both directions, see lib/events-validation.ts), so
 * there's no Server Component wrapper fetching props for it.
 */
export default function EventForm() {
  const [state, formAction] = useActionState(addEvent, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="text"
        name="title"
        placeholder="Event title"
        required
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      <select
        name="eventType"
        defaultValue="race"
        className="h-11 rounded border border-gray-300 px-4 text-base"
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
        required
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      <input
        type="text"
        name="location"
        placeholder="Location (optional)"
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      <input
        type="text"
        name="notes"
        placeholder="Notes (optional)"
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button
        type="submit"
        className="flex h-11 items-center justify-center rounded bg-black px-4 text-base text-white"
      >
        Add event
      </button>
    </form>
  );
}
