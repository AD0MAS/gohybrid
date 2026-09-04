export type BackDestination = { href: string; label: string };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolves a page's BackLink target from a `from` search-param value: a
 * lookup in `sources`, a fixed map the destination page itself owns, never
 * an interpolation of the raw param into a href. A missing, misspelled, or
 * forged value falls through to `fallback` — so `from` can only ever
 * resolve to one of the page's own hardcoded BackDestinations, never to an
 * arbitrary URL supplied by the request.
 */
export function resolveBackDestination(
  from: string | string[] | undefined,
  sources: Record<string, BackDestination>,
  fallback: BackDestination
): BackDestination {
  const key = firstValue(from);
  return (key !== undefined && sources[key]) || fallback;
}
