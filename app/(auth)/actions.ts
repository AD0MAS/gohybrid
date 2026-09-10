"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SITE_URL } from "@/lib/site";

/**
 * Maps a Supabase sign-in error to a message the user can act on.
 * Matched on `error.code`, not `error.message`, which is free text not
 * meant to be parsed. "invalid_credentials" covers both an unknown email
 * and a wrong password — Supabase deliberately returns the same error for
 * both, so collapsing them here preserves that rather than leaking which
 * one it was.
 */
function mapSignInError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Invalid email or password.";
    case "email_not_confirmed":
      return "Please confirm your email address — check your inbox for the confirmation link.";
    default:
      console.error("Unexpected sign-in error:", error);
      return "Something went wrong. Please try again.";
  }
}

/**
 * Signs in an existing user with email + password via Supabase Auth.
 * On success, revalidates the root layout and redirects to "/".
 * On failure, redirects back to /login with a mapped error message
 * attached as a query parameter so the page can display it.
 */
export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(mapSignInError(error))}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Maps a Supabase sign-up error to a message the user can act on.
 * Matched on `error.code`, the way signIn's errors are mapped. With email
 * confirmation enabled, Supabase never returns `email_exists` or
 * `user_already_exists` from signUp — it obfuscates a duplicate address as a
 * success with an empty `identities` array instead, handled separately in
 * signUp itself.
 */
function mapSignUpError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "weak_password":
      return "Password must be at least 6 characters.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    default:
      console.error("Unexpected sign-up error:", error);
      return "Something went wrong. Please try again.";
  }
}

/**
 * Registers a new user with email + password via Supabase Auth.
 * No session exists immediately after signUp either way — email
 * confirmation is required first — so there's never a "/" to redirect to.
 * On failure, redirects back to /register with a mapped error message.
 * On success, Supabase obfuscates an already-registered address as a
 * success with no error: the returned user's `identities` array is empty
 * rather than populated. That case redirects back to /register with an
 * error; a genuinely new sign-up redirects to /register?sent=1, where the
 * page shows a persistent "check your inbox" message instead of the form.
 */
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/login?confirmed=1`,
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(mapSignUpError(error))}`);
  }

  if (data.user?.identities?.length === 0) {
    redirect(
      `/register?error=${encodeURIComponent("An account with this email already exists.")}`
    );
  }

  redirect("/register?sent=1");
}

/**
 * Signs out the current user via Supabase Auth, revalidates the root
 * layout, and redirects to /login.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
