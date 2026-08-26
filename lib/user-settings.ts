import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { unitSystemEnum, userSettings } from "@/db/schema";
import { APP_TIMEZONE, getCurrentDateString } from "./timezone";
import type { ValidatedUserSettingsInput } from "./user-settings-validation";

export type UserSettings = {
  timezone: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
};

/**
 * The settings a user gets before ever saving any — the same values the
 * user_settings columns themselves default to (db/schema.ts), kept here as
 * one definition so getUserSettings's no-row fallback and the DB default
 * can't drift apart. lib/timezone.ts's APP_TIMEZONE — the old module-level
 * constant every AT TIME ZONE query used before this became a per-user
 * setting — now exists only to define this default.
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  timezone: APP_TIMEZONE,
  unitSystem: "metric",
};

/**
 * Returns `userId`'s settings, or DEFAULT_USER_SETTINGS when no row exists
 * yet. Deliberately does NOT insert a row on read and does NOT touch the
 * auth/registration flow — every existing user has no user_settings row at
 * all, and must keep working exactly as before (Europe/Vilnius, metric)
 * with no migration/backfill step. A row is only ever created by actually
 * saving settings (see updateUserSettings). `userId` is a required first
 * parameter, not read from a session internally — with RLS disabled, this
 * filter is the only thing preventing one user from reading another
 * user's settings.
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [row] = await db
    .select({
      timezone: userSettings.timezone,
      unitSystem: userSettings.unitSystem,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  return row ?? DEFAULT_USER_SETTINGS;
}

export type UserContext = UserSettings & {
  /** YYYY-MM-DD, "today" in the user's own timezone — see
   * getCurrentDateString in lib/timezone.ts. Never Postgres's bare
   * `current_date` (UTC) and never a JavaScript Date on the application
   * server: both would disagree with the user's actual calendar day near
   * midnight in every timezone that isn't UTC. */
  today: string;
};

/**
 * The one place a Server Component or Server Action should reach for both
 * "which timezone" and "what day is it" — resolves `userId`'s settings and
 * today's date in that timezone together, so a caller can never end up
 * combining a user's timezone with a UTC-derived "today" (the bug this
 * function exists to make impossible: two different notions of "today" in
 * one calculation). Wrapped in React's `cache()` so the several components
 * that need this within one request/render (e.g. /stats' four charts, or
 * /profile's Goals and Events sections) share one pair of queries instead
 * of each repeating them — `cache()` dedupes by argument, so this only
 * saves work when they're called with the same `userId`, which every
 * caller here is.
 */
export const getUserContext = cache(
  async (userId: string): Promise<UserContext> => {
    const settings = await getUserSettings(userId);
    const today = await getCurrentDateString(settings.timezone);
    return { ...settings, today };
  }
);

/**
 * Creates or updates `userId`'s settings row in one upsert — the first
 * save creates the row (there was none before), and every save after that
 * updates it in place. `input` is already validated (see
 * validateUserSettingsInput in lib/user-settings-validation.ts).
 */
export async function updateUserSettings(
  userId: string,
  input: ValidatedUserSettingsInput
): Promise<UserSettings> {
  const [row] = await db
    .insert(userSettings)
    .values({
      userId,
      timezone: input.timezone,
      unitSystem: input.unitSystem,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { timezone: input.timezone, unitSystem: input.unitSystem },
    })
    .returning({
      timezone: userSettings.timezone,
      unitSystem: userSettings.unitSystem,
    });

  return row;
}
