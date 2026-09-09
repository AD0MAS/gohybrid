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
