import { daysUntil, formatCountdown, getNextEventForUser } from "@/lib/events";
import { formatEventDateTime } from "@/lib/events-format";
import EventForm from "./profile/EventForm";
import { EVENT_TYPE_LABELS } from "./profile/event-labels";

type NextEventCardProps = {
  userId: string;
  today: string;
};

/**
 * Home's Next event card: the single soonest upcoming event and its
 * countdown (getNextEventForUser, daysUntil, formatCountdown — the exact
 * functions /profile's own Events section uses, so the two can't disagree
 * about "how many days"), or an "Add an event" empty state. Renders
 * EventForm (app/(app)/profile/EventForm.tsx) directly for that empty
 * state, same as EventsList's own hero does — a Server Component can render
 * a Client Component with plain serializable props (`ctaLabel` is a string),
 * it just can't hand it a function, which this never needs to.
 */
export default async function NextEventCard({
  userId,
  today,
}: NextEventCardProps) {
  const event = await getNextEventForUser(userId, today);
  const days = event ? daysUntil(event.eventDate, today) : 0;

  return (
    <section
      className={`flex flex-col rounded-panel border border-hairline bg-surface-1 p-5 ${
        event ? "gap-4" : "gap-3"
      }`}
    >
      <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
        Next event
      </h2>

      {event ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="break-words text-[15px] font-medium text-ink-muted">
              {event.title}
            </p>
            <p className="mt-1.5 text-xs text-ink-tertiary">
              {EVENT_TYPE_LABELS[event.eventType].label}
              {event.eventDate
                ? ` · ${formatEventDateTime(event.eventDate, event.eventTime)}`
                : ""}
            </p>
          </div>
          {days > 1 ? (
            <div className="shrink-0 text-right">
              <p className="text-2xl font-semibold leading-none text-ink">
                {days}
              </p>
              <p className="mt-1.5 text-[11px] text-ink-tertiary">days</p>
            </div>
          ) : (
            <p className="shrink-0 text-sm font-medium text-ink">
              {formatCountdown(days)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-subtle">
          No races or tests yet. Add one and Home will count down to it.
        </p>
      )}

      {/* Always mounted, whether or not there is an event yet: the save that
          adds the first upcoming event flips this card from its empty state
          to the event, and a form that lived only in the empty state would
          unmount with it, taking its "Saved" banner along before it painted.
          `hidden` hides only the button once an event exists — same as
          /profile's EventsList hero. */}
      <EventForm ctaLabel="Add an event" hidden={event !== null} />
    </section>
  );
}
