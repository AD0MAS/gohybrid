import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * /login and /register are the only routes a crawler can ever reach —
 * middleware (utils/supabase/middleware.ts) redirects every other request
 * without a session to /login before its page renders, and API routes never
 * serve HTML worth indexing. The explicit allow list plus a blanket
 * disallow, rather than listing every private route, is the standard
 * robots.txt pattern for "everything except these": crawlers resolve the
 * more specific rule first, so /login and /register stay crawlable while
 * disallow: "/" catches every other path, /api included, without needing to
 * be kept in sync as routes are added.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/register"],
      disallow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
