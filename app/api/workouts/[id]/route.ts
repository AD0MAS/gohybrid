import { NextResponse } from "next/server";
import { db } from "@/db";
import { createClient } from "@/utils/supabase/server";
import { isValidUuid } from "@/app/workouts/validation";

/**
 * GET /api/workouts/[id]
 * Returns one of the authenticated user's workouts with its blocks and
 * items nested — blocks ordered by sort_order, and items within each
 * block ordered by sort_order. Responds 401 if there is no authenticated
 * user. Responds 404 both when the id doesn't exist and when it belongs
 * to a different user — deliberately indistinguishable, so a request
 * can't be used to confirm that a given workout id exists at all.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/workouts/[id]">
) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workout = await db.query.workouts.findFirst({
    where: (workouts, { and, eq }) =>
      and(eq(workouts.id, id), eq(workouts.userId, user.id)),
    with: {
      blocks: {
        orderBy: (blocks, { asc }) => [asc(blocks.sortOrder)],
        with: {
          items: {
            orderBy: (items, { asc }) => [asc(items.sortOrder)],
            with: {
              exercise: true,
            },
          },
        },
      },
    },
  });

  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(workout);
}
