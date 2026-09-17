"use client";

import { SubmitButton } from "@/app/_components/FormStatus";
import type { Event } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "../profile/event-labels";
import EventForm from "../profile/EventForm";
import { deleteEvent } from "../profile/events-actions";
import CardMenu, { MENU_ITEM_CLASSES, MENU_ITEM_DANGER_CLASSES } from "./CardMenu";

type EventCardProps = {
  event: Event;
};

/**
 * One event rendered as a day card, the same shape as WeekStrip's own
 * scheduled-workout cards — title, a pill, a CardMenu — for WeekStrip's day
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
 * today — for the same reason ConfirmModal/Modal/CardMenu do: a small
 * client widget meant to be shared across more than one (app) feature
 * folder. It still imports EventForm, EVENT_TYPE_LABELS and deleteEvent
 * from profile/, because that's where the event feature's own components/
 * actions live (profile/ owns the Events section) — WeekStrip already
 * reached into profile/ the same way before this file existed; moving here
 * only changes which shared-widget file does the reaching, not the
 * direction of the dependency.
 *
 * Only Edit and Remove — an event has no done/skipped state in the schema,
 * so it never carries WeekStrip's Mark done/Mark skipped/Reschedule/Open
 * workout items. Edit is EventForm's `renderTrigger`, rendered as a plain
 * CardMenu row (the same menu-item shape ScheduleWorkoutForm's own
 * `triggerVariant="menu-item"` produces); Remove reuses deleteEvent
 * directly, no confirmation step — matches /profile's own event delete
 * exactly, unlike unscheduleWorkout's Completed-only ConfirmModal on the
 * workout cards, since deleting an event has no session/history side
 * effect to warn about.
 */
export default function EventCard({ event }: EventCardProps) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-card border border-hairline bg-surface-2 p-4">
      <div className="min-w-0 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words font-medium text-ink">{event.title}</span>
          <span className="shrink-0 rounded-small bg-accent/15 px-3 py-0.5 text-xs text-accent">
            Event
          </span>
        </div>
        <p className="text-sm text-ink-subtle">
          {[EVENT_TYPE_LABELS[event.eventType].label, event.location]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <CardMenu>
        <EventForm
          entry={event}
          renderTrigger={(open) => (
            <button type="button" onClick={open} className={MENU_ITEM_CLASSES}>
              Edit
            </button>
          )}
        />
        <form action={deleteEvent.bind(null, event.id)}>
          <SubmitButton className={MENU_ITEM_DANGER_CLASSES}>
            Remove
          </SubmitButton>
        </form>
      </CardMenu>
    </li>
  );
}
