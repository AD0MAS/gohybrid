import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/(auth)/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <p className="text-sm">Logged in as {user.email}</p>

      <Link href="/workouts" className="underline">
        Workouts
      </Link>

      <Link href="/history" className="underline">
        Training History
      </Link>

      <form action={signOut}>
        <button type="submit" className="rounded bg-black p-2 text-white">
          Log out
        </button>
      </form>
    </main>
  );
}
