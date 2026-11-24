/**
 * Whether public sign-up is open. Off unless REGISTRATION_ENABLED is
 * "true": the live portfolio deployment runs closed, with the demo account
 * as the way in, and Supabase's own "Allow new users to sign up" switch off
 * to match. The sign-up code stays — turning both back on reopens it.
 */
export function isRegistrationEnabled(): boolean {
  return process.env.REGISTRATION_ENABLED === "true";
}
