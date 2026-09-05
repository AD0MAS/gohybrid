import { signOut } from "@/app/(auth)/actions";
import { SubmitButton } from "@/app/_components/FormStatus";
import { requireUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/user-settings";
import BackLink from "../_components/BackLink";
import SettingsFields from "./SettingsFields";

/**
 * Settings (GOHYBRID_PLAN.md §5 Layer 4): account details + sign-out (moved
 * here from /profile), then timezone and unit system, reached from the
 * Profile page's corner button. getUserSettings falls back to
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
        <div className="flex items-center gap-2">
          <BackLink href="/profile" label="Profile" />
          <h1 className="text-xl font-semibold text-ink">Settings</h1>
        </div>

        <section className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-6">
          <h2 className="text-lg font-semibold text-ink">Account</h2>
          <p className="text-sm text-ink-subtle">{user.email}</p>
          <form action={signOut}>
            <SubmitButton className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
              Sign out
            </SubmitButton>
          </form>
        </section>

        <SettingsFields
          timezones={timezones}
          currentTimezone={settings.timezone}
          currentUnitSystem={settings.unitSystem}
        />
      </div>
    </main>
  );
}
