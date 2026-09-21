// Pure event display helpers — no `db` import, so a client component (EventCard)
// can use them; lib/events.ts reaches the database and cannot be bundled there.

/**
 * An event's time as shown — HH:MM, the same slice scheduled workouts' times
 * use — or null for an all-day event, so a caller can `.filter(Boolean)` it
 * into a meta line or append it after the date.
 */
export function formatEventTime(eventTime: string | null): string | null {
  return eventTime ? eventTime.slice(0, 5) : null;
}

/**
 * The date with the time after it when there is one ("2026-10-04 09:30"),
 * for the lists that print an event's YYYY-MM-DD date. All-day events show
 * the date alone.
 */
export function formatEventDateTime(
  eventDate: string,
  eventTime: string | null
): string {
  const time = formatEventTime(eventTime);
  return time ? `${eventDate} ${time}` : eventDate;
}
