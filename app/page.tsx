import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import WeekStrip from "./WeekStrip";

export default async function Home(props: PageProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-6 p-6">
      <p className="text-sm">Logged in as {user.email}</p>

      <WeekStrip userId={user.id} searchParams={searchParams} />

      <Link href="/calendar" className="self-end text-sm underline">
        Full calendar
      </Link>

      <div className="flex flex-col gap-4">
        <Link href="/workouts" className="underline">
          Workouts
        </Link>

        <Link href="/history" className="underline">
          Training History
        </Link>

        <Link href="/schedule" className="underline">
          Upcoming
        </Link>

        <form action={signOut}>
          <button type="submit" className="rounded bg-black p-2 text-white">
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
