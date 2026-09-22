import { UNIT_SYSTEMS } from "@/db/enums";
import { isOneOf } from "./workouts-validation";

export type ValidatedUserSettingsInput = {
  timezone: string;
  unitSystem: (typeof UNIT_SYSTEMS)[number];
};

type UserSettingsValidationResult =
  | { success: true; data: ValidatedUserSettingsInput }
  | { success: false; error: string };

/** Raw, untyped settings input as received from a FormData submission. */
type RawUserSettingsInput = {
  timezone?: unknown;
  unitSystem?: unknown;
};

/**
 * Validates settings input. Rules: timezone must be one of
 * Intl.supportedValuesOf("timeZone") — the runtime's own IANA database is
 * the source of truth, so this deliberately doesn't hand-maintain a list
 * that could drift from it; unitSystem must be one of the enum values
 * defined in db/schema.ts.
 */
export function validateUserSettingsInput(
  input: RawUserSettingsInput
): UserSettingsValidationResult {
  const timezone = input.timezone;
  if (
    typeof timezone !== "string" ||
    !Intl.supportedValuesOf("timeZone").includes(timezone)
  ) {
    return { success: false, error: "Timezone must be a valid time zone." };
  }

  const unitSystem = input.unitSystem;
  if (!isOneOf(unitSystem, UNIT_SYSTEMS)) {
    return {
      success: false,
      error: "Choose valid units.",
    };
  }

  return { success: true, data: { timezone, unitSystem } };
}
