import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth";
import BodyMetricForm from "./BodyMetricForm";
import BodyMetricsList from "./BodyMetricsList";
import PersonalRecordForm from "./PersonalRecordForm";
import PersonalRecordsList from "./PersonalRecordsList";

/**
 * Profile (GOHYBRID_PLAN.md §5A): account details and sign-out, with a
 * Settings corner button in the top-right — the first use of the
 * corner-button pattern that /workouts and /workouts/library adopt next.
 * Layer 4 adds Body Metrics and Personal Records here.
 */
export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Profile</h1>
        <Link
          href="/settings"
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        >
          Settings
        </Link>
      </div>

      <p className="text-sm text-gray-600">{user.email}</p>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded bg-black p-2 text-sm text-white"
        >
          Sign out
        </button>
      </form>

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
    </main>
  );
}
