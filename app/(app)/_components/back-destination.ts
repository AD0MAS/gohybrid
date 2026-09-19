import { firstValue } from "@/lib/search-params";
import { isValidUuid } from "@/lib/uuid";

export type BackDestination = { href: string; label: string };

/**
 * Resolves a page's BackLink target from a `from` search-param value: a
 * lookup in `sources`, a fixed map the destination page itself owns, never
 * an interpolation of the raw param into a href. A missing, misspelled, or
 * forged value falls through to `fallback` — so `from` can only ever
 * resolve to one of the page's own hardcoded BackDestinations, never to an
 * arbitrary URL supplied by the request.
 *
 * The one exception is `from=workout`, and only for a page that passes its
 * `workout` search param as the fourth argument: the destination is
 * `/workouts/<id>`, built from an id that passed isValidUuid in full. A
 * value that matches the pattern cannot contain a slash, a dot or a query
 * character, so the href can only ever be a workout detail route. A missing
 * or malformed id falls through to `fallback`, and `from=workout` on a page
 * that passes no `workout` argument does too — the map is not consulted for
 * that key, so no page's `sources` can shadow or be shadowed by it.
 */
export function resolveBackDestination(
  from: string | string[] | undefined,
  sources: Record<string, BackDestination>,
  fallback: BackDestination,
  workout?: string | string[] | undefined
): BackDestination {
  const key = firstValue(from);

  if (key === "workout") {
    const id = firstValue(workout);
    return id !== undefined && isValidUuid(id)
      ? { href: `/workouts/${id}`, label: "Workout" }
      : fallback;
  }

  return (key !== undefined && sources[key]) || fallback;
}
