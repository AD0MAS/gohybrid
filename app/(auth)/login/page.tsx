import Link from "next/link";
import { signIn } from "../actions";

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Log in</h1>

        {error && (
          <p className="rounded border border-danger/40 bg-surface-2 p-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form action={signIn} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              name="email"
              required
              className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              type="password"
              name="password"
              required
              className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Log in
          </button>
        </form>

        <p className="text-sm text-ink-subtle">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-ink underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
