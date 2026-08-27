import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/user-settings";
import SettingsFields from "./SettingsFields";

/**
 * Settings (GOHYBRID_PLAN.md §5 Layer 4): timezone and unit system, reached
 * from the Profile page's corner button. getUserSettings falls back to
 * DEFAULT_USER_SETTINGS for a user who hasn't saved anything yet, so this
 * page renders sensible defaults with no row in user_settings. The
 * timezone options come from Intl.supportedValuesOf("timeZone") — computed
 * here, server-side, and passed down as a prop rather than called in the
 * client component.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Settings</h1>
          <Link
            href="/profile"
            className="flex h-11 items-center justify-center rounded border border-gray-300 px-4 text-base"
          >
            Profile
          </Link>
        </div>

        <SettingsFields
          timezones={timezones}
          currentTimezone={settings.timezone}
          currentUnitSystem={settings.unitSystem}
        />
      </div>
    </main>
  );
}
