/**
 * The one place a calendar entry's status becomes a label and a colour.
 * Every surface that shows a status — the week strip's pills, the dots in
 * the strip's and the month calendar's day cells, the calendar's legend —
 * reads this table, so a status cannot look different in two places.
 * Dependency-free on purpose: no `db`, no React, so any Server or Client
 * Component may import it.
 *
 * Class names are written out in full (never assembled) so Tailwind sees
 * them.
 */

/** A scheduled workout's state, or an event. */
export type EntryStatus = "completed" | "planned" | "skipped" | "event";

/**
 * A scheduled entry's status, derived the way the schema stores it: a
 * session link means completed, `is_skipped` means skipped, neither means
 * planned. (Events have no status; they are `"event"` by kind.)
 */
export function getScheduledStatus(entry: {
  sessionId: string | null;
  isSkipped: boolean;
}): Exclude<EntryStatus, "event"> {
  if (entry.sessionId) return "completed";
  if (entry.isSkipped) return "skipped";
  return "planned";
}

export const STATUS_LABELS: Record<EntryStatus, string> = {
  completed: "Completed",
  planned: "Planned",
  skipped: "Skipped",
  event: "Event",
};

/** Status colour as a 6 px dot (day cells, legend). */
export const STATUS_DOT_CLASSES: Record<EntryStatus, string> = {
  completed: "bg-success",
  planned: "bg-ink-muted",
  skipped: "bg-ink-tertiary",
  event: "bg-accent",
};

/** Status colour as a tinted pill (the week strip's day cards); each status
 * tints its own colour into the background at low opacity. */
export const STATUS_PILL_CLASSES: Record<
  Exclude<EntryStatus, "event">,
  string
> = {
  completed: "bg-success/15 text-success",
  planned: "bg-ink-muted/15 text-ink-muted",
  skipped: "bg-ink-tertiary/15 text-ink-tertiary",
};
