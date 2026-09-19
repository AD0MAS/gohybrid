/**
 * Next.js repeats a search param as a string array when it appears more than
 * once in the URL; every caller here only ever wants the first occurrence.
 * Imports nothing — this module is reachable from client components (e.g.
 * via back-destination.ts), so it must never gain a dependency that pulls in
 * db/index.ts or any other server-only module.
 */
export function firstValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads a `?saved=` param: `<value>` or `<value>.<nonce>`, where value is
 * lowercase letters/digits ("1", "rescheduled") and nonce a short
 * alphanumeric token. lib/redirect-back.ts appends a fresh nonce to every
 * redirect it builds, so two redirects to the same page and view are
 * distinguishable (RedirectSuccessBanner reacts to the nonce changing);
 * Settings and the builder redirect with a bare `1`. Anything else, or a
 * missing param, is null. Imports nothing, like the rest of this module.
 */
export function parseSavedParam(
  raw: string | string[] | undefined
): { value: string; nonce: string | null } | null {
  const match = /^([a-z0-9]+)(?:\.([a-z0-9]{1,16}))?$/.exec(firstValue(raw) ?? "");
  return match ? { value: match[1], nonce: match[2] ?? null } : null;
}
