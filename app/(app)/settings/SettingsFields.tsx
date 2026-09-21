"use client";

import { useActionState } from "react";
import { unitSystemEnum } from "@/db/schema";
import {
  FormErrorMessage,
  FormPendingBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
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
  metric: "Metric",
  imperial: "Imperial",
};

/** The units each system actually shows, as convertible in lib/units.ts:
 * weights (kg / lb), distances (m, km / ft, mi) and running pace (per km /
 * per mi). HYROX stations stay in metres under both. */
const UNIT_SYSTEM_HINT = "Metric: m, km, kg, min/km. Imperial: ft, mi, lb, min/mi.";

/**
 * The settings form as a client component, needed for useActionState: a
 * validation failure from saveSettings renders here as { error } above the
 * submit button instead of throwing into app/error.tsx. `timezones` is
 * computed server-side (Intl.supportedValuesOf("timeZone") in page.tsx)
 * and passed down as a prop rather than called here — several hundred
 * options are cheap to render once on the server, and the client component
 * doesn't need the Intl call at all.
 *
 * Both controls are uncontrolled (defaultValue / defaultChecked), each keyed on its own
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
 * Keying each control on its current* prop sidesteps this rather than
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
    <form action={formAction} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-5">
        <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
          Preferences
        </h2>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="settings-timezone"
              className="text-xs font-medium text-ink-subtle"
            >
              Timezone
            </label>
            <select
              id="settings-timezone"
              key={currentTimezone}
              name="timezone"
              defaultValue={currentTimezone}
              className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-tertiary">
              Dates and scheduling use this zone.
            </p>
          </div>

          <fieldset
            key={currentUnitSystem}
            className="flex min-w-0 flex-col gap-1.5"
          >
            <legend className="mb-1.5 text-xs font-medium text-ink-subtle">
              Unit system
            </legend>
            <div className="grid h-11 grid-cols-2 gap-1 rounded-control border border-hairline bg-surface-2 p-1">
              {unitSystemEnum.enumValues.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center justify-center rounded-small border border-transparent text-sm font-medium text-ink-subtle hover:text-ink active:text-ink has-[:checked]:border-hairline-strong has-[:checked]:bg-surface-3 has-[:checked]:text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-focus"
                >
                  <input
                    type="radio"
                    name="unitSystem"
                    value={value}
                    defaultChecked={value === currentUnitSystem}
                    className="sr-only"
                  />
                  {UNIT_SYSTEM_LABELS[value]}
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-tertiary">{UNIT_SYSTEM_HINT}</p>
          </fieldset>
        </div>
      </section>

      <FormErrorMessage error={state.error} />

      {/* No FormSuccessBanner here: saveSettings redirects to /profile on
          success (see actions.ts), so useActionState's state never actually
          resolves to a "saved" value — this component unmounts before any
          success state could render. /profile itself shows the success
          confirmation instead, via RedirectSuccessBanner reading the
          `?saved=1` the redirect appends (see app/_components/FormStatus.tsx
          and profile/page.tsx). The pending banner here still matters: it
          covers the gap between clicking Save and that redirect landing. */}
      <div className="flex sm:justify-end">
        <SubmitButton className="flex h-11 w-full items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto">
          Save
        </SubmitButton>
      </div>
      <FormPendingBanner label="Saving…" />
    </form>
  );
}
