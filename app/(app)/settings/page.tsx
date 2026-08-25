import { requireUser } from "@/lib/auth";

/**
 * Placeholder for Settings (GOHYBRID_PLAN.md §5 Layer 4: units, theme,
 * language, and the per-user APP_TIMEZONE). Exists now so the Profile
 * corner button has somewhere real to link rather than 404ing.
 */
export default async function SettingsPage() {
  await requireUser();

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="text-sm text-gray-600">
        Settings arrive in Layer 4 — units, theme, and language.
      </p>
    </main>
  );
}
