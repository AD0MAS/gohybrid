"use client";

import { ChevronRight } from "lucide-react";
import { SubmitButton } from "@/app/_components/FormStatus";
import type { Event } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "../profile/event-labels";
import EventForm from "../profile/EventForm";
import { deleteEvent } from "../profile/events-actions";

const REMOVE_BUTTON_CLASSES =
  "text-sm text-ink-subtle hover:text-danger active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

type EventCardProps = {
  event: Event;
};

/**
 * One event rendered as a card of the same shape as a workout card — hover
 * state, chevron on the right, a bottom Remove action — for WeekStrip's day
 * list, and available to /calendar later if it grows a similar list. A
 * client component (unlike WeekStrip/CalendarPage, both Server Components)
 * purely so it can hand EventForm's `renderTrigger` a function: that prop
 * can only ever be passed by a client-component caller, since a function
 * can't cross from a Server Component into a Client Component (see
 * EventForm's own doc comment) — client-to-client, an ordinary closure
 * prop is fine. Splitting this out keeps that requirement local to one
 * small leaf instead of forcing WeekStrip itself to become a client
 * component (the week strip and calendar are deliberately kept as pure
 * Server Components driven by search-param navigation).
 *
 * Lives in app/(app)/_components — not under workouts/, its only caller
 * today — for the same reason ConfirmModal/Modal/DistanceInput/
 * DurationInput do: a small client widget meant to be shared across more
 * than one (app) feature folder. It still imports EventForm,
 * EVENT_TYPE_LABELS and deleteEvent from profile/, because that's where the
 * event feature's own components/actions live (profile/ owns the Events
 * section) — WeekStrip already reached into profile/ the same way before
 * this file existed; moving here only changes which shared-widget file
 * does the reaching, not the direction of the dependency.
 *
 * The card's title is EventForm's `renderTrigger`, stretched via
 * after:absolute after:inset-0 the same way a workout card's title Link
 * is, so clicking anywhere on the card opens the edit modal — one button,
 * one way in, no second Edit control competing with it. Remove sits in a
 * sibling `relative z-10` wrapper, layered above that stretched ::after
 * overlay, same technique WeekStrip's own scheduled-workout cards use for
 * their Mark done/skipped/Remove row: z-index and paint order decide which
 * element receives a click, not whether the stretched element underneath
 * is an <a> (workout card) or a <button onClick> (this one), so a Remove
 * click still lands on the (higher, z-10) Remove button rather than
 * falling through to the title button's overlay beneath it. Remove reuses
 * deleteEvent directly, no confirmation step — matches /profile's own
 * event delete exactly, unlike unscheduleWorkout's Completed-only
 * ConfirmModal on the workout cards, since deleting an event has no
 * session/history side effect to warn about.
 */
export default function EventCard({ event }: EventCardProps) {
  return (
    <li className="relative cursor-pointer rounded-lg border border-hairline bg-surface-1 py-5 pl-5 pr-10 hover:bg-surface-2 has-[button:active]:bg-surface-2">
      <EventForm
        entry={event}
        renderTrigger={(open) => (
          <button
            type="button"
            onClick={open}
            className="font-medium text-ink after:absolute after:inset-0 hover:text-accent active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {event.title}
          </button>
        )}
      />

      <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-subtle">
        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-sm text-accent">
          Event
        </span>
        {[EVENT_TYPE_LABELS[event.eventType].label, event.location]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="relative z-10 mt-2 flex gap-4">
        <form action={deleteEvent.bind(null, event.id)}>
          <SubmitButton className={REMOVE_BUTTON_CLASSES}>
            Remove
          </SubmitButton>
        </form>
      </div>
      <ChevronRight className="absolute right-5 top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 text-ink-subtle" />
    </li>
  );
}
