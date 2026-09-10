import type { Metadata } from "next";
import Link from "next/link";
import {
  FormPendingBanner,
  RedirectSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import { signIn } from "../actions";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const { error } = searchParams;
  const confirmed =
    (Array.isArray(searchParams.confirmed)
      ? searchParams.confirmed[0]
      : searchParams.confirmed) === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Log in to your account</h1>

        <RedirectSuccessBanner
          show={confirmed}
          label="Email confirmed. Sign in to continue."
          paramName="confirmed"
        />

        {error && (
          <p className="rounded-md border border-danger/40 bg-surface-2 p-2 text-sm text-danger">
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
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              type="password"
              name="password"
              required
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <SubmitButton className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
            Log in
          </SubmitButton>
          <FormPendingBanner label="Signing in…" />
        </form>

        <p className="text-sm text-ink-subtle">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-ink underline hover:text-accent active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
