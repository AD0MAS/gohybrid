import { X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  daysUntil,
  formatCountdown,
  getPastEventsForUser,
  getUpcomingEventsForUser,
} from "@/lib/events";
import { getUserContext } from "@/lib/user-settings";
import EventForm from "./EventForm";
import { EVENT_TYPE_LABELS } from "./event-labels";
import { deleteEvent } from "./events-actions";

/**
 * Upcoming events soonest first, each with its countdown (via daysUntil +
 * formatCountdown), type and location, plus past events collapsed behind a
 * native `<details>` disclosure — same JS-free toggle GoalsList uses for
 * archived goals. Fetches its own data given `userId` via requireUser(),
 * same self-fetching convention as GoalsList/PersonalRecordsList. The
 * countdown is computed from getUserContext()'s `today` (cached, shared
 * with GoalsList/BodyMetricForm/PersonalRecordForm), not a client-side
 * `new Date()` — see daysUntil in lib/events.ts. Each row's Edit trigger
 * embeds an EventForm instance directly (entry={event}) — same one-modal-
 * per-row wiring as GoalsList, since EventForm already owns its own
 * open/close state and useActionState call.
 */
export default async function EventsList() {
  const user = await requireUser();
  const { today } = await getUserContext(user.id);
  const [upcoming, past] = await Promise.all([
    getUpcomingEventsForUser(user.id, today),
    getPastEventsForUser(user.id, today),
  ]);

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
        No events yet. Add one above to start tracking.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-subtle">No upcoming events.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-2 rounded border border-hairline bg-surface-1 p-5"
            >
              <div>
                <p className="text-sm font-semibold">
                  {event.title} · {formatCountdown(daysUntil(event.eventDate, today))}
                </p>
                <p className="text-sm text-ink-subtle">
                  {EVENT_TYPE_LABELS[event.eventType].label}
                  {event.location ? ` · ${event.location}` : ""} ·{" "}
                  {event.eventDate}
                </p>
                {event.notes && (
                  <p className="text-sm text-ink-subtle">{event.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <EventForm entry={event} />
                <form action={deleteEvent.bind(null, event.id)}>
                  <button
                    type="submit"
                    aria-label="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <details className="rounded border border-hairline">
          <summary className="cursor-pointer p-3 text-sm text-ink-subtle">
            Past events ({past.length})
          </summary>
          <ul className="flex flex-col gap-2 p-3 pt-0">
            {past.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-2 rounded border border-hairline bg-surface-1 p-5"
              >
                <div>
                  <p className="text-sm">{event.title}</p>
                  <p className="text-sm text-ink-subtle">
                    {EVENT_TYPE_LABELS[event.eventType].label}
                    {event.location ? ` · ${event.location}` : ""} ·{" "}
                    {event.eventDate}
                  </p>
                  {event.notes && (
                    <p className="text-sm text-ink-subtle">{event.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <EventForm entry={event} />
                  <form action={deleteEvent.bind(null, event.id)}>
                    <button
                      type="submit"
                      aria-label="Delete"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
