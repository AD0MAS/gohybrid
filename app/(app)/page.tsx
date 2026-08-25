import Link from "next/link";
import { requireUser } from "@/lib/auth";
import WeekStrip from "./WeekStrip";

/**
 * Home: the week strip for at-a-glance planning. The nav shell covers
 * navigation to the other top-level pages, so this page holds only what's
 * specific to it (GOHYBRID_PLAN.md §5A) — summary cards and recent
 * activity land here in Layer 3's page restructure.
 */
export default async function Home(props: PageProps<"/">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-6 p-6">
      <WeekStrip userId={user.id} searchParams={searchParams} />

      <Link href="/calendar" className="self-end text-sm underline">
        Full calendar
      </Link>
    </main>
  );
}
