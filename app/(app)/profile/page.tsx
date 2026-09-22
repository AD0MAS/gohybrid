import type { Metadata } from "next";
import Link from "next/link";
import { RedirectSuccessBanner } from "@/app/_components/FormStatus";
import { requireUser } from "@/lib/auth";
import { getTotalGoalCountForUser } from "@/lib/goals";
import { parseSavedParam } from "@/lib/search-params";
import { PAGE_MAIN_CLASSES, SECONDARY_BUTTON_CLASSES_SURFACE_1 } from "../_components/shared-classes";
import BodyMetricsList from "./BodyMetricsList";
import EventsList from "./EventsList";
import GoalForm from "./GoalForm";
import GoalsList from "./GoalsList";
import PersonalRecordsList from "./PersonalRecordsList";

export const metadata: Metadata = {
  title: "Profile",
};

/**
 * Profile: Goals, Events, Body Metrics and Personal Records, each its own
 * self-contained section (bordered surface-1 panel, own heading, own data
 * fetch) — same convention /stats' SummaryCards/ActivityHeatmap/WeeklyChart
 * already use, rather than this page owning a shared section wrapper around
 * four *List components. Goals is the exception: because it's the one
 * section whose Add action is promoted to this page's own header as the
 * single accent call-to-action (every other section's Add stays a quiet
 * text trigger inside its own panel — see GoalsList/EventsList/
 * BodyMetricsList/PersonalRecordsList), GoalForm (a thin Server Component
 * fetching just what that button's form needs) is still rendered here
 * rather than folded into GoalsList itself. Account details and sign-out
 * live on /settings instead, reached via the Settings corner button.
 *
 * GoalForm is rendered once. The header is a CSS grid: below `sm` the title
 * and Settings share the first row and the Add goal button gets its own
 * full-width row underneath; from `sm` up all three sit on one row. It is
 * shown only when a goal has ever existed: GoalsList's own hero empty state
 * already offers the identical action ("Set your first goal") for exactly
 * that case, and showing the header's "Add goal" button too would put two
 * controls that do the same thing on screen at once. Once a goal exists —
 * active, all archived, or a mix — the header is the only Add-goal control;
 * GoalsList's all-archived state used to carry its own in-section copy of
 * this same button, which put it beside every other state's own quiet
 * explanatory text instead of matching them (see GoalsList's own doc
 * comment). The catalog and custom-name queries behind GoalForm, GoalsList
 * and PersonalRecordsList are `cache()`d, so the sections share one of each
 * per render. `hasAnyGoal` (one `count(*)`, getTotalGoalCountForUser in
 * lib/goals.ts, counting archived goals too — unlike the total this page
 * used before) is the one query this page adds beyond what each section
 * already fetches for itself — unlike the header summary line ("6 goals · 2
 * events · 4 records") rejected earlier, which needed three separate counts
 * to render text that only repeated what the sections below already show,
 * this single count decides what actually renders.
 *
 * One tree, four sections, each its own async Server Component doing its
 * own query — never rendered twice for the two breakpoints. Below `lg` it
 * reads as a single column in this order: Goals, Events, Body metrics,
 * Personal records. From `lg` it splits into two independent vertical
 * stacks: Goals above Personal records on the left, Events above Body
 * metrics on the right.
 *
 * Two earlier versions of this got one property right and the other wrong:
 *
 * 1. Four sections placed directly into a shared two-row CSS Grid via
 *    `col-start`/`row-start` gave the right mobile order for free (plain DOM
 *    order reads top to bottom below `lg`), but a grid row's height is the
 *    tallest item placed in it regardless of `align-items` — `items-start`
 *    only stops a *shorter* row-mate from stretching to fill the row, it
 *    doesn't stop the row's own height from being set by the taller one.
 *    Personal records (left, row 2) and Body metrics (right, row 2) shared a
 *    row track, so Body metrics started wherever that track began — set by
 *    whichever of Goals/Events (row 1) was taller — instead of directly
 *    under Events' own bottom edge.
 * 2. Two real `flex flex-col` columns (Goals+Personal records / Events+Body
 *    metrics, each its own wrapper) fixed that: a flex column's height is
 *    only the sum of its own children, so the two stacks grow independently
 *    and Body metrics always sits a normal gap below Events. But it fixed
 *    the DOM itself into two groups, which is also what mobile read — Goals,
 *    Personal records, Events, Body metrics — losing the interleaved order.
 *
 * The fix keeps exactly the (2) DOM grouping (so the independent-height
 * property survives), but makes each group's wrapper `contents` below `lg`:
 * a `display: contents` element generates no box of its own and vanishes
 * from layout entirely, promoting its children to be direct flex items of
 * the *outer* container instead. Below `lg` the outer container is one
 * `flex flex-col`, so with both wrappers `contents` it is, in effect, a
 * single flat list of all four sections — and each section's own `order-*`
 * (Goals 1, Events 2, Body metrics 3, Personal records 4) places them in
 * reading order independent of which desktop column they'll belong to. From
 * `lg` the wrappers stop being `contents` and become `flex flex-col`
 * themselves, so they're back to being two ordinary grid items (this outer
 * container is `lg:grid lg:grid-cols-[5fr_3fr]`), each an independent
 * height-summing stack of its own two sections in plain DOM order
 * (`lg:order-none` discards the mobile ordering, which doesn't apply once
 * the wrapper is a real box again). No section's JSX is duplicated and no
 * section runs its query twice — only the thin `order-N`/`lg:order-none` div
 * around each `<...List userId={user.id} />` call exists purely as an
 * `order` hook, since `order` has to target the actual flex item and these
 * Server Components each return their own bare `<section>`.
 *
 * `min-w-0` on both `contents` wrappers is what stops a long, unbroken
 * string somewhere inside a section (an event title, a note) from widening
 * that whole column past its `5fr`/`3fr` share: a grid item's own
 * `min-width` defaults to `auto`, which means "at least as wide as my
 * content wants," not "my share of the track." `break-words` inside each
 * section (GoalsList/EventsList/BodyMetricsList/PersonalRecordsList) is
 * what makes that content wrap instead of overflowing outright, but nothing
 * in any of those sections can shrink its own *column* below its content's
 * natural width without this — the two are complementary, not redundant:
 * break-words keeps the text itself readable, `min-w-0` here keeps the grid
 * honest about each column's actual share regardless of what's inside it.
 * A no-op below `lg`, where these wrappers are `contents` and generate no
 * box for `min-width` to apply to.
 *
 * `?saved=1` marks a landing from saveSettings' redirect (settings/
 * actions.ts) — the only way this page is ever reached with that param, so
 * RedirectSuccessBanner (app/_components/FormStatus.tsx) only shows on that
 * arrival, never a plain visit to /profile.
 */
export default async function ProfilePage(props: PageProps<"/profile">) {
  const user = await requireUser();
  const [searchParams, totalGoalCount] = await Promise.all([
    props.searchParams,
    getTotalGoalCountForUser(user.id),
  ]);
  const savedParam = parseSavedParam(searchParams.saved);
  const saved = savedParam?.value === "1";
  const hasAnyGoal = totalGoalCount > 0;

  return (
    <main className={PAGE_MAIN_CLASSES}>
      <RedirectSuccessBanner
        show={saved}
        label="Saved"
        paramName="saved"
        nonce={savedParam?.nonce}
      />

      <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-5 sm:grid-cols-[1fr_auto_auto] sm:gap-y-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-page-title">
          Profile
        </h1>
        <Link
          href="/settings"
          className={SECONDARY_BUTTON_CLASSES_SURFACE_1}
        >
          Settings
        </Link>
        {hasAnyGoal && (
          <div className="col-span-2 sm:col-span-1">
            <GoalForm userId={user.id} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[5fr_3fr] lg:items-start">
        <div className="contents min-w-0 lg:flex lg:flex-col lg:gap-6">
          <div className="order-1 lg:order-none">
            <GoalsList userId={user.id} />
          </div>
          <div className="order-4 lg:order-none">
            <PersonalRecordsList userId={user.id} />
          </div>
        </div>
        <div className="contents min-w-0 lg:flex lg:flex-col lg:gap-6">
          <div className="order-2 lg:order-none">
            <EventsList userId={user.id} />
          </div>
          <div className="order-3 lg:order-none">
            <BodyMetricsList userId={user.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
