import type { MetadataRoute } from "next";
import { isRegistrationEnabled } from "@/lib/registration";
import { SITE_URL } from "@/lib/site";

/**
 * Only /login (and /register while registration is enabled) are reachable
 * to a crawler (see app/robots.ts) — every other route sits behind the auth
 * redirect and has nothing to list here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = isRegistrationEnabled() ? ["/login", "/register"] : ["/login"];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
}
