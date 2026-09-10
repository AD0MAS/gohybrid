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
      return "Invalid email or password";
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
 * Registers a new user with email + password via Supabase Auth.
 * On success, revalidates the root layout and redirects to "/".
 * On failure, redirects back to /register with the error message attached
 * as a query parameter so the page can display it.
 */
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/login?confirmed=1`,
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
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
