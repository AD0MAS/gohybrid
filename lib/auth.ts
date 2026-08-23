import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

/**
 * Returns the authenticated user for use in a Server Component or Server
 * Action, redirecting to /login if there is none. Use this instead of
 * calling supabase.auth.getUser() directly so every protected page and
 * action shares one auth check.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Returns the authenticated user for use in a Route Handler, or null if
 * there is none, so the caller can respond 401 with a JSON body instead
 * of the HTML redirect that requireUser() performs.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
