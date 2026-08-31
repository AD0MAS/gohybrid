/**
 * Flattens a failed FormData submission into a plain string record, echoed
 * back on the `{ status: "error" }` branch of a *FormState so the form that
 * submitted it can restore exactly what the user typed. Needed because
 * React calls a native `form.reset()` after a useActionState action
 * completes, including on failure — that snaps every field's DOM value back
 * to its defaultValue/first-option without going through React's own state,
 * so re-deriving `defaultValue` from this echoed data (combined with
 * remounting the form via a key, see GoalFields) is what actually restores
 * the field. See GoalFields' doc comment for the full mechanism.
 */
export function echoFormValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}
