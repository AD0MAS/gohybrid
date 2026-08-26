"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updateUserSettings } from "@/lib/user-settings";
import { validateUserSettingsInput } from "@/lib/user-settings-validation";

export type SettingsFormState = { error: string | null };

/**
 * Saves the authenticated user's settings (upsert — see
 * updateUserSettings). Passed to useActionState in SettingsFields, same
 * pattern as the other Layer 4 forms: a validation failure returns
 * { error } for the form to render instead of throwing into
 * app/error.tsx. Revalidates every route whose queries read
 * getUserSettings — /settings itself, /profile (Goals), / (Home summary
 * cards) and /stats (all four charts) — so a saved timezone/unit change is
 * reflected immediately rather than on next navigation.
 */
export async function saveSettings(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requireUser();

  const result = validateUserSettingsInput({
    timezone: formData.get("timezone"),
    unitSystem: formData.get("unitSystem"),
  });

  if (!result.success) {
    return { error: result.error };
  }

  await updateUserSettings(user.id, result.data);

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/stats");
  return { error: null };
}
