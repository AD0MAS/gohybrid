import { isValidUuid } from "./uuid";
import { checkTextLength, SCHEDULE_NOTES_MAX_LENGTH } from "./text-limits";

export type ValidatedScheduleInput = {
  workoutId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  notes: string | null;
};

export type ScheduleValidationResult =
  | { success: true; data: ValidatedScheduleInput }
  | { success: false; error: string };

/** Raw, untyped scheduling input as received from either a JSON request
 * body or a FormData submission. */
export type RawScheduleInput = {
  workoutId?: unknown;
  scheduledDate?: unknown;
  scheduledTime?: unknown;
  notes?: unknown;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

/**
 * Checks whether a value is a syntactically valid ISO calendar date
 * (YYYY-MM-DD) — the string shape a Postgres `date` column round-trips as
 * through Drizzle. Doesn't check that the date is a real calendar day
 * (e.g. 2024-02-30); an invalid one is rejected by Postgres itself at
 * insert time.
 */
export function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && DATE_REGEX.test(value);
}

/**
 * Checks whether a value is a syntactically valid YYYY-MM month string —
 * the /calendar page's `month` search param shape.
 */
export function isValidMonthString(value: unknown): value is string {
  return typeof value === "string" && MONTH_REGEX.test(value);
}

/**
 * Checks whether a value is a syntactically valid 24-hour clock time,
 * either HH:MM (the format an `<input type="time">` submits) or HH:MM:SS
 * (the format Postgres `time` columns round-trip as through Drizzle).
 */
export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_REGEX.test(value);
}

/**
 * Validates and normalizes scheduling input. Shared by
 * POST /api/scheduled-workouts, PATCH /api/scheduled-workouts/[id] and the
 * scheduleWorkout/rescheduleWorkout Server Actions, so none of them can
 * drift apart. Rules: workoutId must be a syntactically valid UUID (for a
 * reschedule, the entry's own unchanged workoutId is passed in — this
 * function doesn't distinguish "creating a plan" from "moving one");
 * scheduledDate must be a YYYY-MM-DD string no earlier than `today`
 * (GOHYBRID_PLAN.md §7 — scheduling, like rescheduling, can no longer target
 * a past date); scheduledTime, if present, must be an HH:MM or HH:MM:SS
 * string, and is normalized to null when absent or empty — a scheduled
 * workout with no specific time is a normal, common state, not a missing
 * value; notes, if present, is trimmed and normalized to null when empty.
 *
 * The past-date rule reaches today's already-elapsed hours too: when
 * scheduledDate is exactly `today` and a scheduledTime is given, that time
 * must not be strictly before `now` — the exact minute is valid (a workout
 * starting right now can still be scheduled), only an earlier one is
 * rejected. No time given on `today` is always fine, same as any other date
 * — "no specific time" carries no instant to compare. Compared on the first
 * 5 characters (HH:MM) regardless of whether scheduledTime carries seconds,
 * since `now` never does.
 *
 * `today`/`now` are required parameters, never defaulted or read internally
 * — same reasoning as every other "what day/time is it" read in this
 * codebase (getUserContext, lib/user-settings.ts): a call site that forgets
 * either is a compile error rather than a silent fall back to a
 * UTC/server-local notion of either. This deliberately does NOT reach
 * `createSessionForWorkout`'s backfill insert (lib/sessions.ts) — that path
 * never calls this function, so a completed workout can still backfill a
 * scheduled_workouts row dated in the past, which is the entire point of a
 * backfill.
 */
export function validateScheduleInput(
  input: RawScheduleInput,
  today: string,
  now: string
): ScheduleValidationResult {
  const workoutId = input.workoutId;
  if (typeof workoutId !== "string" || !isValidUuid(workoutId)) {
    return {
      success: false,
      error: "The request does not include a valid workout.",
    };
  }

  const scheduledDate = input.scheduledDate;
  if (!isValidDateString(scheduledDate)) {
    return {
      success: false,
      error: "Date must be a valid date.",
    };
  }
  if (scheduledDate < today) {
    return {
      success: false,
      error: "Date can't be in the past.",
    };
  }

  let scheduledTime: string | null = null;
  if (typeof input.scheduledTime === "string" && input.scheduledTime !== "") {
    if (!isValidTimeString(input.scheduledTime)) {
      return {
        success: false,
        error: "Time must be a valid time.",
      };
    }
    scheduledTime = input.scheduledTime;
  }

  if (
    scheduledDate === today &&
    scheduledTime !== null &&
    scheduledTime.slice(0, 5) < now
  ) {
    return {
      success: false,
      error: "Time can't be in the past.",
    };
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;
  if (notes !== null) {
    const notesCheck = checkTextLength(notes, SCHEDULE_NOTES_MAX_LENGTH, "Notes");
    if (!notesCheck.ok) {
      return { success: false, error: notesCheck.error };
    }
  }

  return {
    success: true,
    data: { workoutId, scheduledDate, scheduledTime, notes },
  };
}

export type ValidatedLogPastSessionInput = {
  workoutId: string;
  date: string;
  time: string | null;
};

export type LogPastSessionValidationResult =
  | { success: true; data: ValidatedLogPastSessionInput }
  | { success: false; error: string };

/** Raw, untyped log-past-session input as received from a FormData
 * submission. */
export type RawLogPastSessionInput = {
  workoutId?: unknown;
  date?: unknown;
  time?: unknown;
};

/**
 * Validates and normalizes input for logPastSession
 * (app/(app)/workouts/actions.ts). Named `date`/`time` rather than
 * `scheduledDate`/`scheduledTime` on purpose — this isn't a scheduled_workouts
 * row, it's a completed session's day.
 *
 * The rule is "before now," not "before today": a future date is always
 * rejected, same as validateScheduleInput's own direction reversed. A past
 * date (date < today) is allowed with or without a time — the exact instant
 * within a bygone day is never knowable to the minute anyway, so
 * createSessionForWorkout falls back to noon (toInstantAtTime,
 * lib/timezone.ts) when none is given. Today (date === today) is allowed
 * only with a time, and only when that time is not strictly after `now` —
 * the exact current minute is valid (a workout that just finished can still
 * be logged), only a later one is rejected — the mirror image of
 * validateScheduleInput's own today-boundary, which rejects only strictly
 * before `now`. Requiring a time at all on `today` (unlike a past date) is
 * what makes "haven't recorded a time yet" distinguishable from "recording
 * this as happening right now," which is what Mark done/Finish are for.
 * `time` is compared against `now` on its first 5 characters (HH:MM)
 * regardless of whether the caller sent HH:MM:SS, so the comparison doesn't
 * depend on precision neither side actually carries meaningfully at this
 * granularity.
 *
 * `today` and `now` are both required, never defaulted — same reasoning
 * validateScheduleInput documents for `today` alone — and both must come
 * from the same getUserContext call (lib/user-settings.ts) so they can't
 * describe two different instants.
 */
export function validateLogPastSessionInput(
  input: RawLogPastSessionInput,
  today: string,
  now: string
): LogPastSessionValidationResult {
  const workoutId = input.workoutId;
  if (typeof workoutId !== "string" || !isValidUuid(workoutId)) {
    return {
      success: false,
      error: "Choose a workout.",
    };
  }

  const date = input.date;
  if (!isValidDateString(date)) {
    return {
      success: false,
      error: "Date must be a valid date.",
    };
  }
  if (date > today) {
    return {
      success: false,
      error: "Date can't be in the future.",
    };
  }

  let time: string | null = null;
  if (typeof input.time === "string" && input.time !== "") {
    if (!isValidTimeString(input.time)) {
      return {
        success: false,
        error: "Time must be a valid time.",
      };
    }
    time = input.time;
  }

  if (date === today) {
    if (time === null) {
      return {
        success: false,
        error: "Today needs a time.",
      };
    }
    if (time.slice(0, 5) > now) {
      return {
        success: false,
        error: "Time can't be in the future.",
      };
    }
  }

  return {
    success: true,
    data: { workoutId, date, time },
  };
}
