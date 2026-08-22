import Link from "next/link";
import { signUp } from "../actions";

export default async function RegisterPage(props: PageProps<"/register">) {
  const { error } = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
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
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <button
          type="submit"
          className="rounded bg-black p-2 text-white"
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
    </main>
  );
}
