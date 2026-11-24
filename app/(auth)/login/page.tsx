import type { Metadata } from "next";
import Link from "next/link";
import {
  FormPendingBanner,
  RedirectSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import { getDemoCredentials } from "@/lib/demo";
import { isRegistrationEnabled } from "@/lib/registration";
import { signIn, signInDemo } from "../actions";
import PasswordField from "../PasswordField";
import {
  FIELD_CLASSES_SURFACE_1,
  SECONDARY_BUTTON_CLASSES_SURFACE_1,
  SUBMIT_BUTTON_CLASSES,
} from "@/app/(app)/_components/shared-classes";

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
  // Only whether the demo is configured reaches the page, never the
  // credentials themselves — signInDemo reads those on the server.
  const demoAvailable = getDemoCredentials() !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Log in to your account</h1>

        <RedirectSuccessBanner
          show={confirmed}
          label="Email confirmed. Log in to continue."
          paramName="confirmed"
        />

        {error && (
          <p className="rounded-control border border-danger/40 bg-surface-2 p-2 text-sm text-danger">
            {error}
          </p>
        )}

        {demoAvailable && (
          <form
            action={signInDemo}
            className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-1 p-4"
          >
            <p className="text-sm text-ink-subtle">
              Just looking around? Open a demo account with a few weeks of
              sample training — no sign-up needed.
            </p>
            <SubmitButton className={SECONDARY_BUTTON_CLASSES_SURFACE_1}>
              Try the demo
            </SubmitButton>
            <FormPendingBanner label="Opening the demo…" />
          </form>
        )}

        <form action={signIn} className="flex flex-col gap-3">
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
              className="h-11 w-full rounded-control border border-hairline bg-surface-1 pl-4 pr-11 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
          </label>

          <SubmitButton className={SUBMIT_BUTTON_CLASSES}>
            Log in
          </SubmitButton>
          <FormPendingBanner label="Signing in…" />
        </form>

        {isRegistrationEnabled() && (
          <p className="text-sm text-ink-subtle">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-ink underline hover:text-accent active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
              Create account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
