import type { Metadata } from "next";
import Link from "next/link";
import { RedirectSuccessBanner } from "@/app/_components/FormStatus";
import { requireUser } from "@/lib/auth";
import { getTotalSessionCountForUser } from "@/lib/activity";
import { formatDayHeadingLong } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";
import { getWorkoutCountForUser } from "@/lib/workouts";
import { parseSavedParam } from "@/lib/search-params";
import { resolveWeekStripView, weekStripHref } from "@/lib/week-strip";
import MonthCalendarPreview from "./MonthCalendarPreview";
import NextEventCard from "./NextEventCard";
import QuickActions from "./QuickActions";
import RecentActivity from "./RecentActivity";
import TodayHero from "./TodayHero";
import WeekStrip from "./WeekStrip";

export const metadata: Metadata = {
  title: "Home",
};

const EYEBROW_CLASSES =
  "text-xs font-medium uppercase tracking-widest text-accent-ink-subtle";

// Exactly /workouts' own empty-state hero button (app/(app)/workouts/page.tsx,
// "Create your first workout") and /profile's (GoalFields.tsx's own accent
// button, rendered as "Set your first goal" by GoalsList's hero) — the same
// h-11/rounded-control/px-5/text-base convention both pages already use for
// a primary, page-owning action.
const PRIMARY_BUTTON_CLASSES =
  "flex h-11 w-full items-center justify-center self-start rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto";

const HOW_IT_WORKS_STEPS = [
  { n: "1", text: "Create a workout — blocks and items you can reuse." },
  { n: "2", text: "Schedule it on a day in the week strip above." },
  { n: "3", text: "Run the checklist; finishing writes a session into Stats." },
] as const;

/**
 * Home: "what do I do today" — the date, a TODAY card for the nearest
 * workout scheduled today, the week strip, a month-calendar preview, the
 * next event's countdown, recent sessions and two quick actions. Deliberately
 * does not repeat /stats' own summary cards (This week/This month/Current
 * streak, or a streak/session count of its own beside the title): those
 * answer "how am I doing," which is /stats' job — Home answers "what's
 * next." No other page carries a stats line beside its own title either.
 *
 * `isNewUser` (no workouts ever AND no completed sessions ever) swaps the
 * TODAY card for a START HERE card and the recent-sessions panel for a
 * three-step "How it works" panel — the first screen after signing up.
 * "Nothing scheduled" isn't a third, independent condition here: since
 * scheduled_workouts.workout_id is `onDelete: "cascade"` (db/schema.ts), a
 * user with zero workouts necessarily has zero scheduled_workouts rows too
 * (a scheduled entry can't outlive the workout it points at), so the two
 * counts already imply it.
 */
export default async function Home(props: PageProps<"/">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  const { today } = await getUserContext(user.id);
  const view = resolveWeekStripView(searchParams, today);

  const [workoutCount, sessionCount] = await Promise.all([
    getWorkoutCountForUser(user.id),
    getTotalSessionCountForUser(user.id),
  ]);
  const isNewUser = workoutCount === 0 && sessionCount === 0;

  // `?saved=…` is where an edit that moved its own entry out from under its
  // form (an event or a scheduled workout to another day) lands — the form's
  // banner unmounted with the entry, so the confirmation is rendered here
  // instead (lib/redirect-back.ts). The page decides which values it accepts
  // and what each says.
  const saved = parseSavedParam(searchParams.saved);
  const savedLabel =
    saved?.value === "1"
      ? "Saved"
      : saved?.value === "rescheduled"
        ? "Rescheduled"
        : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <RedirectSuccessBanner
        show={savedLabel !== null}
        label={savedLabel ?? ""}
        paramName="saved"
        nonce={saved?.nonce}
      />
      <div className="sm:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-lockup.svg" alt="GoHybrid" className="h-7 w-auto" />
      </div>

      <h1 className="truncate text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">
        {formatDayHeadingLong(today)}
      </h1>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[5fr_3fr] lg:items-start">
        <div className="contents min-w-0 lg:flex lg:flex-col lg:gap-6">
          <div className="order-1 lg:order-none">
            {isNewUser ? (
              <section className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-6 sm:p-7">
                <p className={EYEBROW_CLASSES}>Start here</p>
                <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
                  Build your first workout
                </h2>
                <p className="max-w-xl text-sm text-ink-subtle">
                  A workout is a reusable template of blocks and items.
                  Schedule it on a day, run it as a checklist, and finishing
                  it writes your first session.
                </p>
                <Link href="/workouts/new?from=home" className={PRIMARY_BUTTON_CLASSES}>
                  Create your first workout
                </Link>
              </section>
            ) : (
              <TodayHero
                userId={user.id}
                today={today}
                returnTo={weekStripHref(view)}
              />
            )}
          </div>
          <div className="order-2 lg:order-none">
            <WeekStrip userId={user.id} searchParams={searchParams} />
          </div>
          <div className="order-5 lg:order-none">
            {isNewUser ? (
              <section className="flex flex-col gap-1 rounded-panel border border-hairline bg-surface-1 p-5">
                <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
                  How it works
                </h2>
                <ul className="flex flex-col">
                  {HOW_IT_WORKS_STEPS.map((step) => (
                    <li
                      key={step.n}
                      className="flex items-center gap-3 border-b border-surface-3 py-3 last:border-b-0"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-small border border-hairline bg-surface-3 text-xs font-medium text-ink-subtle">
                        {step.n}
                      </span>
                      <span className="text-sm text-ink-subtle">{step.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <RecentActivity userId={user.id} />
            )}
          </div>
        </div>

        <div className="contents min-w-0 lg:flex lg:flex-col lg:gap-6">
          <div className="order-3 hidden sm:block lg:order-none">
            <MonthCalendarPreview
              userId={user.id}
              anchorDate={view.selectedDate ?? today}
              today={today}
            />
          </div>
          <div className="order-4 lg:order-none">
            <NextEventCard userId={user.id} today={today} />
          </div>
          <div className="order-6 lg:order-none">
            <QuickActions userId={user.id} today={today} />
          </div>
        </div>
      </div>
    </main>
  );
}
