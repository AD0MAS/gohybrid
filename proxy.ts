import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Root Next.js proxy (middleware). Delegates to the Supabase session helper
 * on every matched request, which refreshes auth cookies and redirects
 * unauthenticated requests to /login for every route except /login and
 * /register.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
