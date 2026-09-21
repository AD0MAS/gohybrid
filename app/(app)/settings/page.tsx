import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/actions";
import { SubmitButton } from "@/app/_components/FormStatus";
import { requireUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/user-settings";
import BackLink from "../_components/BackLink";
import SettingsFields from "./SettingsFields";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * Settings: the account panel (email + sign-out), then the preferences form
 * (timezone and unit system) with its Save button, reached from the Profile
 * page's corner button. Sign-out is its own <form> above the settings form
 * rather than inside it — forms can't nest, and the two actions are
 * unrelated. getUserSettings falls back to DEFAULT_USER_SETTINGS for a user
 * who hasn't saved anything yet, so this page renders sensible defaults with
 * no row in user_settings. The timezone options come from
 * Intl.supportedValuesOf("timeZone") — computed here, server-side, and
 * passed down as a prop rather than called in the client component.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <BackLink href="/profile" label="Profile" />
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">
          Settings
        </h1>
      </div>

      <section className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-5">
        <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
          Account
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-subtle">Email</span>
            <span className="break-words text-sm text-ink-muted">
              {user.email}
            </span>
          </div>
          <form action={signOut} className="shrink-0">
            <SubmitButton className="flex h-11 w-full items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto">
              Sign out
            </SubmitButton>
          </form>
        </div>
      </section>

      <SettingsFields
        timezones={timezones}
        currentTimezone={settings.timezone}
        currentUnitSystem={settings.unitSystem}
      />
    </main>
  );
}
