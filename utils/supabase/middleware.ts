import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRegistrationEnabled } from "@/lib/registration";

/**
 * Refreshes the Supabase auth session for an incoming request, mirrors any
 * updated cookies onto both the request (so this response cycle sees them)
 * and the response (so the browser stores them), and redirects
 * unauthenticated requests to /login for every route except the public auth
 * pages and API routes. /login is the landing page because it carries "Try
 * the demo", the way into the live deployment while registration is closed;
 * /register counts as public only while registration is enabled
 * (lib/registration.ts). API routes are exempt from the redirect
 * because a caller there expects a JSON 401 from the Route Handler, not an
 * HTML redirect — each Route Handler is responsible for its own auth
 * check. Also redirects the other way: a request that already has a
 * session but targets a public auth page is sent to / instead, so a
 * logged-in user can't land on an empty auth form. Intended to be called
 * from the root middleware/proxy on every matched request.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Must be getUser(), not getSession(): getSession() only decodes the
  // session cookie locally and trusts whatever it contains, so a forged or
  // stale cookie would pass. getUser() sends the token to the Supabase Auth
  // server and returns a user only if it's still genuinely valid — the
  // right check for a gate that runs on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPaths = isRegistrationEnabled() ? ["/login", "/register"] : ["/login"];
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname);
  const isApiPath = request.nextUrl.pathname.startsWith("/api/");

  if (!user && !isPublicPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
