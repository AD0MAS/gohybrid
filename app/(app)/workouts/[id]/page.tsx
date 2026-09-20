import { Pencil, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RedirectSuccessBanner } from "@/app/_components/FormStatus";
import { requireUser } from "@/lib/auth";
import { formatDayMonthLong } from "@/lib/dates";
import { getUpcomingScheduledForWorkout } from "@/lib/scheduled-workouts";
import { isValidDateString } from "@/lib/scheduled-workouts-validation";
import { firstValue } from "@/lib/search-params";
import { getSessionsForWorkout } from "@/lib/sessions";
import { toCalendarDayInTimezone } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/uuid";
import {
  formatBlockTimingLine,
  formatItemSummary,
} from "@/lib/workout-summary";
import { deleteWorkout, toggleFavorite } from "../actions";
import BackLink from "../../_components/BackLink";
import {
  resolveBackDestination,
  type BackDestination,
} from "../../_components/back-destination";
import CardMenu, {
  MENU_ITEM_CLASSES,
  MENU_ITEM_DANGER_CLASSES,
} from "../../_components/CardMenu";
import { BLOCK_TYPE_LABELS } from "../builder/block-type-labels";
import { TARGET_PRESET_LABELS } from "../builder/target-preset-labels";
import { TARGET_TYPE_LABELS } from "../builder/target-type-labels";
import { DIFFICULTY_LABELS } from "../difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "../primary-type-labels";
import { TAG_COLOR_CLASSES } from "../tag-colors";
import ConfirmModal from "../../_components/ConfirmModal";
import LogPastSessionForm from "../../_components/LogPastSessionForm";
import ScheduleWorkoutForm from "../../_components/ScheduleWorkoutForm";
import FavoriteToggle from "../FavoriteToggle";

export const metadata: Metadata = {
  title: "Workout",
};

const DEFAULT_BACK: BackDestination = {
  href: "/workouts",
  label: "My Workouts",
};

/** Where the `from` search param can send the back link, keyed by the value
 * each entry point passes — see resolveBackDestination for why `from` is
 * looked up here rather than trusted directly. "home-strip" is a base
 * value only: resolveBack below rebuilds its href with the week strip's
 * `week`/`day` restored, once each is independently re-validated. Both
 * "home" and "home-strip" resolve to "/" (the week strip lives on Home) —
 * they stay two separate keys because only "home-strip" carries week/day
 * state back with it. */
const BACK_SOURCES: Record<string, BackDestination> = {
  home: { href: "/", label: "Home" },
  "home-strip": { href: "/", label: "Home" },
};

const ITEM_SUMMARY_LABELS = {
  targetPreset: TARGET_PRESET_LABELS,
  targetType: TARGET_TYPE_LABELS,
};

const SESSIONS_LIMIT = 3;
const SCHEDULED_LIMIT = 3;

const HEADER_TRIGGER_CLASSES =
  "rounded-control border border-hairline bg-surface-2 px-4 py-1.5 text-xs font-medium text-ink hover:border-hairline-strong hover:bg-surface-3 active:border-hairline-strong active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

// Same look as the two components' own default trigger, with px-4 below sm
// so "Schedule" and "Log a past session" (both flex-auto, nowrap) share one
// row on a 360px phone with equal space either side of each label.
const SECONDARY_ACTION_CLASSES =
  "flex h-12 items-center justify-center rounded-control border border-hairline bg-surface-1 px-4 text-base font-medium text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:px-6";

/**
 * Resolves the back link, same map-lookup contract as resolveBackDestination
 * — but when `from=home-strip`, the week strip's selected week/day are also
 * restored onto the fixed / (Home) base, so returning to the strip doesn't
 * lose which day was open. `week`/`day` are re-validated here (an integer,
 * and lib/scheduled-workouts-validation's YYYY-MM-DD check) rather than
 * trusted as received, so a malformed pair degrades to a bare / instead of
 * ever being passed through unchecked.
 */
function resolveBack(
  searchParams: Record<string, string | string[] | undefined>
): BackDestination {
  const from = firstValue(searchParams.from);
  const base = resolveBackDestination(from, BACK_SOURCES, DEFAULT_BACK);

  if (from !== "home-strip") {
    return base;
  }

  const rawWeek = firstValue(searchParams.week);
  const week = rawWeek !== undefined && Number.isInteger(Number(rawWeek))
    ? rawWeek
    : undefined;
  const rawDay = firstValue(searchParams.day);
  const day = isValidDateString(rawDay) ? rawDay : undefined;

  const query = new URLSearchParams();
  if (week !== undefined) query.set("week", week);
  if (day !== undefined) query.set("day", day);
  const qs = query.toString();

  return { href: qs ? `/?${qs}` : base.href, label: base.label };
}

/**
 * Workout detail page: one header group (back link, title, favorite, meta,
 * tags, description, Start workout/Schedule/Log a past session, and
 * Edit/Delete in the corner), the block/item structure, and — in a right-hand column
 * from lg — this workout's most recent sessions and its upcoming scheduled
 * entries. Queries the database directly via lib/workouts rather than
 * fetching /api/workouts/[id] — same reasoning as the /workouts list: a
 * Server Component runs in the same process as the database layer, so a
 * self-fetch would only add a network round trip and a duplicate auth
 * check.
 *
 * A missing id, a malformed id, and an id belonging to another user all
 * render the same not-found page, so this page never confirms whether a
 * given id exists. Reachable from /workouts (the library) and
 * the week strip on Home, so the back link's target depends on the
 * `from` search param each sets — see resolveBack above.
 *
 * `?saved=1` marks a landing from createFullWorkout/updateFullWorkout's
 * redirect (builder/actions.ts) — none of this page's other entry points
 * (`from=home`, `from=home-strip&week=...&day=...`, or no param at all from
 * the library) ever set it, so RedirectSuccessBanner (app/_components/
 * FormStatus.tsx) only shows right after a builder Save, never on a plain
 * visit.
 */
export default async function WorkoutDetailPage(
  props: PageProps<"/workouts/[id]">
) {
  const { id } = await props.params;
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const back = resolveBack(searchParams);
  const saved = firstValue(searchParams.saved) === "1";

  if (!isValidUuid(id)) {
    notFound();
  }

  const [workout, { unitSystem, today, timezone }] = await Promise.all([
    getWorkoutForUser(id, user.id),
    getUserContext(user.id),
  ]);

  if (!workout) {
    notFound();
  }

  const [sessions, scheduled] = await Promise.all([
    getSessionsForWorkout(user.id, workout.id, SESSIONS_LIMIT),
    getUpcomingScheduledForWorkout(user.id, workout.id, today, SCHEDULED_LIMIT),
  ]);

  const deleteWorkoutWithId = deleteWorkout.bind(null, workout.id);
  const description = workout.description?.trim() ?? "";

  const blockCount = workout.blocks.length;
  const itemCount = workout.blocks.reduce(
    (sum, block) => sum + block.items.length,
    0
  );
  const structureCount = `${blockCount} block${blockCount === 1 ? "" : "s"} · ${itemCount} item${itemCount === 1 ? "" : "s"}`;

  const metaLine = [
    PRIMARY_TYPE_LABELS[workout.primaryType].label,
    DIFFICULTY_LABELS[workout.difficulty].label,
    workout.estimatedDurationMinutes != null &&
      `${workout.estimatedDurationMinutes} min`,
    structureCount,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <RedirectSuccessBanner show={saved} label="Saved" paramName="saved" />

      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <BackLink href={back.href} label={back.label} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">
                  {workout.title}
                </h1>
                <FavoriteToggle
                  isFavorite={workout.isFavorite}
                  toggleFavoriteAction={toggleFavorite.bind(null, workout.id)}
                />
              </div>
              <p className="text-sm text-ink-tertiary">{metaLine}</p>
              {workout.workoutTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {workout.workoutTags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className={`rounded-small border px-3 py-1 text-xs ${TAG_COLOR_CLASSES[tag.color]}`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Link
              href={`/workouts/${workout.id}/edit`}
              className="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              Edit
            </Link>
            <ConfirmModal
              trigger="Delete"
              triggerClassName="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              title="Delete workout"
              description="Deleting this workout removes its blocks and items with it. Any completed sessions from this workout stay in your training history."
              confirmLabel="Delete"
              action={deleteWorkoutWithId}
            />
          </div>

          <div className="shrink-0 sm:hidden">
            <CardMenu>
              <Link
                href={`/workouts/${workout.id}/edit`}
                className={MENU_ITEM_CLASSES}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
              <ConfirmModal
                trigger={
                  <>
                    <X className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </>
                }
                triggerClassName={MENU_ITEM_DANGER_CLASSES}
                title="Delete workout"
                description="Deleting this workout removes its blocks and items with it. Any completed sessions from this workout stay in your training history."
                confirmLabel="Delete"
                action={deleteWorkoutWithId}
              />
            </CardMenu>
          </div>
        </div>
        <div className="sm:pl-11">
          {description && (
            <p className="mt-3.5 max-w-[600px] whitespace-pre-line break-words text-[13px] leading-[1.6] text-ink-subtle sm:mt-[18px] sm:text-sm">
              {description}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:items-center">
            <Link
              href={`/workouts/${workout.id}/start`}
              className="flex h-12 w-full items-center justify-center rounded-control bg-accent px-6 text-base font-medium text-ink hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto"
            >
              Start workout
            </Link>
            <div className="flex gap-3">
              <ScheduleWorkoutForm
                today={today}
                workoutId={workout.id}
                triggerClassName={`${SECONDARY_ACTION_CLASSES} flex-auto whitespace-nowrap`}
              />
              <LogPastSessionForm
                today={today}
                workoutId={workout.id}
                triggerClassName={`${SECONDARY_ACTION_CLASSES} flex-auto whitespace-nowrap`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[5fr_3fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
                Structure
              </h2>
              <span className="text-xs text-ink-tertiary">{structureCount}</span>
            </div>

            <ul className="flex flex-col gap-4">
              {workout.blocks.map((block, blockIndex) => {
                const timingLine = formatBlockTimingLine({
                  blockType: block.blockType,
                  durationSeconds: block.durationSeconds,
                  rounds: block.rounds,
                  workSeconds: block.workSeconds,
                  restSeconds: block.restSeconds,
                  intervalSeconds: block.intervalSeconds,
                });

                return (
                  <li
                    key={block.id}
                    className="rounded-card border border-hairline bg-surface-2 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="min-w-0 break-words text-sm font-medium text-ink">
                          {block.title || `Block ${blockIndex + 1}`}
                        </span>
                        <span className="shrink-0 rounded-small border border-hairline bg-surface-3 px-2 py-[3px] text-[11px] font-medium text-ink-subtle">
                          {BLOCK_TYPE_LABELS[block.blockType].label}
                        </span>
                      </div>
                      {timingLine && (
                        <span className="text-xs text-ink-tertiary">
                          {timingLine}
                        </span>
                      )}
                    </div>

                    {block.items.length === 0 ? (
                      <p className="text-sm text-ink-subtle">No items yet.</p>
                    ) : (
                      <div>
                        {block.items.map((item) => {
                          const name =
                            item.exercise?.name ??
                            item.customName ??
                            "Unnamed exercise";
                          const summaryLine = formatItemSummary(
                            {
                              isRestItem: item.exercise?.category === "rest",
                              isHyroxStation:
                                item.exercise?.isHyroxStation ?? false,
                              sets: item.sets,
                              volumeType: item.volumeType,
                              volumeValue: item.volumeValue,
                              targetType: item.targetType,
                              targetValue: item.targetValue,
                              targetPreset: item.targetPreset,
                              weightKg: item.weightKg,
                              restSeconds: item.restSeconds,
                            },
                            unitSystem,
                            ITEM_SUMMARY_LABELS
                          );

                          return (
                            <div
                              key={item.id}
                              className="border-b border-surface-3 py-3 last:border-b-0"
                            >
                              <p className="break-words text-sm font-medium text-ink-muted">
                                {name}
                              </p>
                              {summaryLine && (
                                <p className="max-w-[600px] text-xs text-ink-tertiary">
                                  {summaryLine}
                                </p>
                              )}
                              {item.notes && (
                                <p className="max-w-[600px] break-words text-xs text-ink-tertiary">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-1 rounded-panel border border-hairline bg-surface-1 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
                Sessions
              </h2>
              <Link
                href={`/history?from=workout&workout=${workout.id}`}
                className={HEADER_TRIGGER_CLASSES}
              >
                Full history
              </Link>
            </div>

            {sessions.length === 0 ? (
              <p className="pt-2 text-sm text-ink-subtle">
                No sessions of this workout yet.
              </p>
            ) : (
              <ul>
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="border-b border-surface-3 py-3 last:border-b-0"
                  >
                    <span className="text-sm font-medium text-ink-muted">
                      {formatDayMonthLong(
                        toCalendarDayInTimezone(session.completedAt, timezone)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface-1 p-5">
            <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
              Scheduled
            </h2>

            {scheduled.length === 0 ? (
              <p className="text-sm text-ink-subtle">Nothing scheduled.</p>
            ) : (
              <ul>
                {scheduled.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 border-b border-surface-3 py-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span className="text-sm font-medium text-ink-muted">
                        {formatDayMonthLong(entry.scheduledDate)}
                      </span>
                    </div>
                    {entry.scheduledTime && (
                      <span className="shrink-0 text-xs text-ink-tertiary">
                        {entry.scheduledTime.slice(0, 5)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="pt-1 text-xs text-ink-tertiary">
              Scheduling, marking done and removing a day all happen on Home.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
