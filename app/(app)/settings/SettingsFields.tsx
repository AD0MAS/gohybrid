"use client";

import { useActionState } from "react";
import { unitSystemEnum } from "@/db/schema";
import { FormPendingBanner, SubmitButton } from "@/app/_components/FormStatus";
import { saveSettings, type SettingsFormState } from "./actions";

type SettingsFieldsProps = {
  timezones: string[];
  currentTimezone: string;
  currentUnitSystem: (typeof unitSystemEnum.enumValues)[number];
};

const initialState: SettingsFormState = { error: null };

const UNIT_SYSTEM_LABELS: Record<
  (typeof unitSystemEnum.enumValues)[number],
  string
> = {
  metric: "Metric (kg, km)",
  imperial: "Imperial (lb, mi)",
};

/**
 * The settings form as a client component, needed for useActionState: a
 * validation failure from saveSettings renders here as { error } above the
 * submit button instead of throwing into app/error.tsx. `timezones` is
 * computed server-side (Intl.supportedValuesOf("timeZone") in page.tsx)
 * and passed down as a prop rather than called here — several hundred
 * options are cheap to render once on the server, and the client component
 * doesn't need the Intl call at all.
 *
 * Both selects are uncontrolled (defaultValue), each keyed on its own
 * current* prop, rather than controlled with state synced during render.
 * The controlled version broke after a save: React resets a `<form>`
 * bound to a useActionState action once the action completes — a native
 * `formElement.reset()` outside React's render/commit cycle — which snaps
 * an uncontrolled-by-React `<select>` back to the browser's own default
 * (its first `<option>`) without going through the `value` prop at all.
 * Because that reset isn't a state change, nothing re-renders afterward to
 * write the correct `value` back into the DOM, so the select is left
 * showing the first option while the component's own state (and the
 * database) still hold the correct saved zone — exactly the "saves
 * correctly, only the display is wrong" symptom, and why the first option
 * in the (alphabetical) IANA list, "Africa/Abidjan," is what appeared.
 * Keying each select on its current* prop sidesteps this rather than
 * fighting it: a save's revalidatePath changes the prop, which changes the
 * key, which makes React discard the old DOM node and mount a fresh one —
 * so `defaultValue` applies again from the new prop regardless of what the
 * native reset did to the now-discarded node. Simpler than mirrored state
 * for a form that revalidatePath fully re-renders on every save anyway.
 */
export default function SettingsFields({
  timezones,
  currentTimezone,
  currentUnitSystem,
}: SettingsFieldsProps) {
  const [state, formAction] = useActionState(saveSettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Timezone
        <select
          key={currentTimezone}
          name="timezone"
          defaultValue={currentTimezone}
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Units
        <select
          key={currentUnitSystem}
          name="unitSystem"
          defaultValue={currentUnitSystem}
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          {unitSystemEnum.enumValues.map((value) => (
            <option key={value} value={value}>
              {UNIT_SYSTEM_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      {/* No FormSuccessBanner here: saveSettings redirects to /profile on
          success (see actions.ts), so useActionState's state never actually
          resolves to a "saved" value — this component unmounts before any
          success state could render. /profile itself shows the success
          confirmation instead, via RedirectSuccessBanner reading the
          `?saved=1` the redirect appends (see app/_components/FormStatus.tsx
          and profile/page.tsx). The pending banner here still matters: it
          covers the gap between clicking Save and that redirect landing. */}
      <SubmitButton className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
        Save
      </SubmitButton>
      <FormPendingBanner label="Saving…" />
    </form>
  );
}
