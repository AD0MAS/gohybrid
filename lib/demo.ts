/**
 * The demo account's credentials, read from server-only environment
 * variables (no NEXT_PUBLIC_ prefix, so they never reach a client bundle).
 * Null when either is missing — the login page then hides "Try the demo"
 * rather than offering a button that can only fail.
 */
export function getDemoCredentials(): { email: string; password: string } | null {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}
