import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/keepalive";

/**
 * GET /api/cron/keepalive
 * Called by Vercel Cron (see vercel.json) to keep the Supabase Free-plan
 * project from being paused for inactivity. Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET environment
 * variable is set; anything else gets a 401, and so does every request when
 * the variable is missing, so the route can't be used to hit the database
 * from outside.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await pingDatabase();

  return NextResponse.json({ ok: true });
}
