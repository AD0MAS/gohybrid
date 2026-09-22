import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { BODY_METRIC_TYPES } from "@/db/enums";
import { bodyMetrics } from "@/db/schema";
import type { ValidatedBodyMetricInput } from "./body-metrics-validation";
import { diffInDays } from "./dates";

export type BodyMetric = {
  id: string;
  userId: string;
  metricType: (typeof BODY_METRIC_TYPES)[number];
  value: number;
  measuredAt: string;
  notes: string | null;
  createdAt: Date;
};

/**
 * Drizzle returns `numeric` columns as strings, so every row read from
 * body_metrics is mapped through this to give
 * callers an actual number for `value`.
 */
function toBodyMetric(row: typeof bodyMetrics.$inferSelect): BodyMetric {
  return { ...row, value: Number(row.value) };
}

/**
 * Lists `userId`'s body metrics, most recently measured first
 * (created_at desc as a tiebreaker between same-day measurements —
 * two weigh-ins on one day are legitimate, see db/schema.ts). Optionally
 * narrowed to a single `metricType`; `userId` is a required first
 * parameter, not read from a session internally, so every call site is
 * forced to supply it explicitly — with RLS disabled, this filter is the
 * only thing preventing one user from reading another user's metrics.
 */
export async function getBodyMetricsForUser(
  userId: string,
  metricType?: (typeof BODY_METRIC_TYPES)[number]
): Promise<BodyMetric[]> {
  const rows = await db
    .select()
    .from(bodyMetrics)
    .where(
      metricType
        ? and(eq(bodyMetrics.userId, userId), eq(bodyMetrics.metricType, metricType))
        : eq(bodyMetrics.userId, userId)
    )
    .orderBy(desc(bodyMetrics.measuredAt), desc(bodyMetrics.createdAt));

  return rows.map(toBodyMetric);
}

/**
 * Records one body metric measurement for `userId`. `input` is already
 * validated (see validateBodyMetricInput in lib/body-metrics-validation.ts);
 * `input.value` is a number here and converted to a string on the way in,
 * since Drizzle's `numeric` columns are written as strings.
 */
export async function createBodyMetricForUser(
  userId: string,
  input: ValidatedBodyMetricInput
): Promise<BodyMetric> {
  const [created] = await db
    .insert(bodyMetrics)
    .values({
      userId,
      metricType: input.metricType,
      value: String(input.value),
      measuredAt: input.measuredAt,
      notes: input.notes,
    })
    .returning();

  return toBodyMetric(created);
}

/**
 * Updates a body metric owned by `userId`, returning the updated
 * BodyMetric or null if nothing matched — whether because the id doesn't
 * exist or because it belongs to a different user. Ownership is enforced
 * in the WHERE clause, same pattern as deleteBodyMetricForUser. `input` is
 * already validated — an update has the same rules as a create (see
 * validateBodyMetricInput), and the write shape mirrors
 * createBodyMetricForUser's exactly.
 */
export async function updateBodyMetricForUser(
  id: string,
  userId: string,
  input: ValidatedBodyMetricInput
): Promise<BodyMetric | null> {
  const [updated] = await db
    .update(bodyMetrics)
    .set({
      metricType: input.metricType,
      value: String(input.value),
      measuredAt: input.measuredAt,
      notes: input.notes,
    })
    .where(and(eq(bodyMetrics.id, id), eq(bodyMetrics.userId, userId)))
    .returning();

  return updated ? toBodyMetric(updated) : null;
}

/**
 * Deletes a body metric owned by `userId`, returning true if a row was
 * deleted and false otherwise — whether because the id doesn't exist or
 * because it belongs to a different user. Ownership is enforced in the
 * WHERE clause, same pattern as deleteWorkoutForUser/unscheduleForUser.
 */
export async function deleteBodyMetricForUser(
  id: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(bodyMetrics)
    .where(and(eq(bodyMetrics.id, id), eq(bodyMetrics.userId, userId)))
    .returning({ id: bodyMetrics.id });

  return deleted.length > 0;
}

type BodyMetricTrend = {
  /** latest.value - previous.value, in the metric's own stored SI unit
   * (kg/%/bpm) — never pre-converted. Display formatting (unit conversion,
   * sign) happens at the boundary, same as every other stored value in this
   * schema — see formatBodyMetricValue in lib/units.ts. */
  deltaValue: number;
  /** Whole days between the two readings' measuredAt dates. */
  daysBetween: number;
};

/**
 * Compares the two most recent readings of one metric type — the latest
 * against the one immediately before it, never a fixed-size window (a "last
 * N readings" cutoff would need a chosen N, and there's no such number
 * anywhere else in this schema). Pure and query-free, same principle as
 * isBetterRecord (lib/personal-records-grouping.ts) and computeGoalProgress:
 * the caller (BodyMetricsList) already has `entries` from
 * getBodyMetricsForUser, which returns newest-measured-first, so this just
 * reads the first two. Returns null when there's nothing to compare against
 * yet (zero or one reading).
 */
export function computeBodyMetricTrend(
  entriesNewestFirst: Pick<BodyMetric, "value" | "measuredAt">[]
): BodyMetricTrend | null {
  if (entriesNewestFirst.length < 2) return null;
  const [latest, previous] = entriesNewestFirst;
  return {
    deltaValue: latest.value - previous.value,
    daysBetween: diffInDays(previous.measuredAt, latest.measuredAt),
  };
}
