import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth";
import BodyMetricForm from "./BodyMetricForm";
import BodyMetricsList from "./BodyMetricsList";
import EventForm from "./EventForm";
import EventsList from "./EventsList";
import GoalForm from "./GoalForm";
import GoalsList from "./GoalsList";
import PersonalRecordForm from "./PersonalRecordForm";
import PersonalRecordsList from "./PersonalRecordsList";

/**
 * Profile (GOHYBRID_PLAN.md §5A): account details and sign-out, with a
 * Settings corner button in the top-right — the first use of the
 * corner-button pattern that /workouts and /workouts/library adopt next.
 * Layer 4 adds Goals, Events, Body Metrics and Personal Records here.
 */
export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Profile</h1>
          <Link
            href="/settings"
            className="flex h-11 items-center justify-center rounded border border-gray-300 px-4 text-base"
          >
            Settings
          </Link>
        </div>

        <p className="text-sm text-gray-600">{user.email}</p>

        <form action={signOut}>
          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded bg-black px-4 text-base text-white"
          >
            Sign out
          </button>
        </form>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Goals</h2>
          <GoalForm />
          <GoalsList />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Events</h2>
          <EventForm />
          <EventsList />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Body Metrics</h2>
          <BodyMetricForm />
          <BodyMetricsList />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Personal Records</h2>
          <PersonalRecordForm />
          <PersonalRecordsList />
        </section>
      </div>
    </main>
  );
}
