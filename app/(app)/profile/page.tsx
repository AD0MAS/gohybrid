import Link from "next/link";
import { Flag, Scale, Target, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import BodyMetricForm from "./BodyMetricForm";
import BodyMetricsList from "./BodyMetricsList";
import EventForm from "./EventForm";
import EventsList from "./EventsList";
import GoalForm from "./GoalForm";
import GoalsList from "./GoalsList";
import PersonalRecordForm from "./PersonalRecordForm";
import PersonalRecordsList from "./PersonalRecordsList";

const SECTION_CLASSES =
  "flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-6";

/**
 * Profile (GOHYBRID_PLAN.md §5A): Goals, Events, Body Metrics and Personal
 * Records, each its own bordered section with an icon + heading on the
 * left of its header row and an Add button on the right. The Add button
 * opens that section's form in a centred Modal (app/(app)/_components/
 * Modal.tsx) — the *Form Server Components below still fetch each
 * section's data server-side and hand it to their *Fields client
 * component, which now also owns the button and the modal itself. Account
 * details and sign-out live on /settings instead, reached via the
 * Settings corner button — the first use of the corner-button pattern
 * that /workouts and /workouts/library adopt next.
 */
export default async function ProfilePage() {
  await requireUser();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">Profile</h1>
          <Link
            href="/settings"
            className="flex h-11 items-center justify-center rounded border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
            <GoalForm />
          </div>
          <GoalsList />
        </section>

        <section className={SECTION_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Events</h2>
            </div>
            <EventForm />
          </div>
          <EventsList />
        </section>

        <section className={SECTION_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Body Metrics</h2>
            </div>
            <BodyMetricForm />
          </div>
          <BodyMetricsList />
        </section>

        <section className={SECTION_CLASSES}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Personal Records</h2>
            </div>
            <PersonalRecordForm />
          </div>
          <PersonalRecordsList />
        </section>
      </div>
    </main>
  );
}
