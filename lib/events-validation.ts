import { eventTypeEnum } from "@/db/schema";
import { isOneOf } from "./workouts-validation";
import { isValidDateString } from "./scheduled-workouts-validation";

export type ValidatedEventInput = {
  title: string;
  eventDate: string;
  eventType: (typeof eventTypeEnum.enumValues)[number];
  location: string | null;
  notes: string | null;
};

export type EventValidationResult =
  | { success: true; data: ValidatedEventInput }
  | { success: false; error: string };

/** Raw, untyped event input as received from a FormData submission. */
export type RawEventInput = {
  title?: unknown;
  eventDate?: unknown;
  eventType?: unknown;
  location?: unknown;
  notes?: unknown;
};

/**
 * Validates and normalizes event input, same (input) => result shape as
 * validatePersonalRecordInput/validateBodyMetricInput minus their `today`
 * parameter (same simplification as validateGoalInput in
 * lib/goals-validation.ts) — a personal record or body metric can't
 * predate itself, but an event's date is deliberately unconstrained in
 * both directions, so there's no "not in the future" rule to check today
 * against: a user may log an upcoming race or one they already ran
 * (GOHYBRID_PLAN.md §5 Layer 4). Rules: title required and trimmed;
 * eventType must be one of the enum values defined in db/schema.ts;
 * eventDate must be a syntactically valid YYYY-MM-DD date; location and
 * notes, if present, are trimmed and normalized to null when empty.
 */
export function validateEventInput(input: RawEventInput): EventValidationResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { success: false, error: "Title is required." };
  }

  const eventType = input.eventType;
  if (!isOneOf(eventType, eventTypeEnum.enumValues)) {
    return {
      success: false,
      error: `eventType must be one of: ${eventTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const eventDate = input.eventDate;
  if (!isValidDateString(eventDate)) {
    return { success: false, error: "eventDate must be a YYYY-MM-DD date." };
  }

  const location =
    typeof input.location === "string" && input.location.trim() !== ""
      ? input.location.trim()
      : null;

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;

  return {
    success: true,
    data: { title, eventDate, eventType, location, notes },
  };
}
