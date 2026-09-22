import type { Metadata } from "next";
import Link from "next/link";
import { FormPendingBanner, SubmitButton } from "@/app/_components/FormStatus";
import { signUp } from "../actions";
import PasswordField from "../PasswordField";
import { FIELD_CLASSES_SURFACE_1, SUBMIT_BUTTON_CLASSES } from "@/app/(app)/_components/shared-classes";

export const metadata: Metadata = {
  title: "Register",
};

export default async function RegisterPage(props: PageProps<"/register">) {
  const searchParams = await props.searchParams;
  const { error } = searchParams;
  const sent =
    (Array.isArray(searchParams.sent)
      ? searchParams.sent[0]
      : searchParams.sent) === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Create your account</h1>

        {error && (
          <p className="rounded-control border border-danger/40 bg-surface-2 p-2 text-sm text-danger">
            {error}
          </p>
        )}

        {sent ? (
          <p className="rounded-control border border-success/40 bg-surface-2 p-2 text-sm text-success">
            Check your inbox to confirm your email address.
          </p>
        ) : (
          <form action={signUp} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                type="email"
                name="email"
                required
                className={FIELD_CLASSES_SURFACE_1}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Password
              <PasswordField
                name="password"
                required
                minLength={6}
                className="h-11 w-full rounded-control border border-hairline bg-surface-1 pl-4 pr-11 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              />
            </label>

            <SubmitButton className={SUBMIT_BUTTON_CLASSES}>
              Create account
            </SubmitButton>
            <FormPendingBanner label="Creating your account…" />
          </form>
        )}

        <p className="text-sm text-ink-subtle">
          Already have an account?{" "}
          <Link href="/login" className="text-ink underline hover:text-accent active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
