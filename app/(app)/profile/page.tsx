import type { Metadata } from "next";
import Link from "next/link";
import { Flag, Scale, Target, Trophy } from "lucide-react";
import { RedirectSuccessBanner } from "@/app/_components/FormStatus";
import { requireUser } from "@/lib/auth";
import BodyMetricForm from "./BodyMetricForm";
import BodyMetricsList from "./BodyMetricsList";
import EventForm from "./EventForm";
import EventsList from "./EventsList";
import GoalForm from "./GoalForm";
import GoalsList from "./GoalsList";
import PersonalRecordForm from "./PersonalRecordForm";
import PersonalRecordsList from "./PersonalRecordsList";

export const metadata: Metadata = {
  title: "Profile",
};

const SECTION_CLASSES =
  "flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-6";

/**
 * Profile: Goals, Events, Body Metrics and Personal
 * Records, each its own bordered section with an icon + heading on the
 * left of its header row and an Add button on the right. The Add button
 * opens that section's form in a centred Modal (app/(app)/_components/
 * Modal.tsx) — the *Form Server Components below still fetch each
 * section's data server-side and hand it to their *Fields client
 * component, which now also owns the button and the modal itself. Account
 * details and sign-out live on /settings instead, reached via the
 * Settings corner button — the first use of the corner-button pattern
 * that /workouts and /workouts/library adopt next.
 *
 * `?saved=1` marks a landing from saveSettings' redirect (settings/
 * actions.ts) — the only way this page is ever reached with that param, so
 * RedirectSuccessBanner (app/_components/FormStatus.tsx) only shows on that
 * arrival, never a plain visit to /profile.
 */
export default async function ProfilePage(props: PageProps<"/profile">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;
  const saved =
    (Array.isArray(searchParams.saved)
      ? searchParams.saved[0]
      : searchParams.saved) === "1";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <RedirectSuccessBanner show={saved} label="Saved" paramName="saved" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">Profile</h1>
          <Link
            href="/settings"
            className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Settings
          </Link>
        </div>

        <section className={SECTION_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Goals</h2>
            </div>
            <GoalForm userId={user.id} />
          </div>
          <GoalsList userId={user.id} />
        </section>

        <section className={SECTION_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Events</h2>
            </div>
            <EventForm />
          </div>
          <EventsList userId={user.id} />
        </section>

        <section className={SECTION_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Body Metrics</h2>
            </div>
            <BodyMetricForm userId={user.id} />
          </div>
          <BodyMetricsList userId={user.id} />
        </section>

        <section className={SECTION_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Personal Records</h2>
            </div>
            <PersonalRecordForm userId={user.id} />
          </div>
          <PersonalRecordsList userId={user.id} />
        </section>
      </div>
    </main>
  );
}
