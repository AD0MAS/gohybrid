const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a string is a syntactically valid UUID. Used to guard
 * lookups by id before they reach the database — an obviously-invalid id
 * would otherwise surface as a raw Postgres error instead of a clean 404 or
 * validation message. Imports nothing, so it is safe from client components
 * and from app/(app)/_components/back-destination.ts.
 */
export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}
