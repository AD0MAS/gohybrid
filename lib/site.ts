/**
 * The app's deployed origin — the one place metadataBase, robots.ts and
 * sitemap.ts resolve absolute URLs from, so none of them hardcode a guess.
 * NEXT_PUBLIC_SITE_URL is set per Vercel environment (Production →
 * https://gohybrid.vercel.app); the localhost fallback keeps metadataBase
 * resolving in local dev without the variable being required there.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
