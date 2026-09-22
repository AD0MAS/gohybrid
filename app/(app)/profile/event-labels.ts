import type { EVENT_TYPES } from "@/db/enums";

type EventType = (typeof EVENT_TYPES)[number];

/**
 * Display label per event_type enum value — the event-type select and the
 * events list both read from here, same pattern as GOAL_TYPE_LABELS.
 */
export const EVENT_TYPE_LABELS: Record<EventType, { label: string }> = {
  race: { label: "Race" },
  competition: { label: "Competition" },
  test: { label: "Test" },
  other: { label: "Other" },
};
