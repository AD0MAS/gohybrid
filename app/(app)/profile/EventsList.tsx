import { requireUser } from "@/lib/auth";
import {
  daysUntil,
  formatCountdown,
  getPastEventsForUser,
  getUpcomingEventsForUser,
} from "@/lib/events";
import { getUserContext } from "@/lib/user-settings";
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
 * `new Date()` — see daysUntil in lib/events.ts.
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
      <p className="text-sm text-gray-600">
        No events yet. Add one above to start tracking.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-600">No upcoming events.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-2 rounded border border-gray-300 p-3"
            >
              <div>
                <p className="text-sm font-semibold">
                  {event.title} · {formatCountdown(daysUntil(event.eventDate, today))}
                </p>
                <p className="text-sm text-gray-600">
                  {EVENT_TYPE_LABELS[event.eventType].label}
                  {event.location ? ` · ${event.location}` : ""} ·{" "}
                  {event.eventDate}
                </p>
                {event.notes && (
                  <p className="text-sm text-gray-600">{event.notes}</p>
                )}
              </div>
              <form action={deleteEvent.bind(null, event.id)}>
                <button type="submit" className="text-sm text-red-700 underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <details className="rounded border border-gray-200">
          <summary className="cursor-pointer p-3 text-sm text-gray-600">
            Past events ({past.length})
          </summary>
          <ul className="flex flex-col gap-2 p-3 pt-0">
            {past.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-200 p-3"
              >
                <div>
                  <p className="text-sm">{event.title}</p>
                  <p className="text-sm text-gray-600">
                    {EVENT_TYPE_LABELS[event.eventType].label}
                    {event.location ? ` · ${event.location}` : ""} ·{" "}
                    {event.eventDate}
                  </p>
                  {event.notes && (
                    <p className="text-sm text-gray-600">{event.notes}</p>
                  )}
                </div>
                <form action={deleteEvent.bind(null, event.id)}>
                  <button
                    type="submit"
                    className="text-sm text-red-700 underline"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
