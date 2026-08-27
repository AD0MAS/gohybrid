import Link from "next/link";
import { signUp } from "../actions";

export default async function RegisterPage(props: PageProps<"/register">) {
  const { error } = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold">Register</h1>

        {error && (
          <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={signUp} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              name="email"
              required
              className="h-11 rounded border border-gray-300 px-4 text-base"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="h-11 rounded border border-gray-300 px-4 text-base"
            />
          </label>

          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded bg-black px-4 text-base text-white"
          >
            Register
          </button>
        </form>

        <p className="text-sm">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
