"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, Home, LogOut, User } from "lucide-react";
import { SubmitButton } from "@/app/_components/FormStatus";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/**
 * True when `href` is the current route or an ancestor of it (e.g.
 * /workouts should stay highlighted on /workouts/[id]). "/" only matches
 * itself, since every path starts with "/".
 */
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavProps = {
  userEmail: string;
  signOutAction: () => Promise<void>;
};

/**
 * Top-level navigation: a persistent left sidebar on
 * desktop (sm and up) and a fixed bottom bar on mobile, both driven by the
 * same NAV_ITEMS list so the two platforms can't drift out of sync — only
 * the surrounding markup and classes differ per breakpoint. Sign-out lives
 * only in the sidebar; on mobile it lives on /profile instead.
 */
export default function Nav({ userEmail, signOutAction }: NavProps) {
  const pathname = usePathname();

  return (
    <>
      <nav className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-hairline bg-canvas p-4 sm:flex">
        <div className="mb-6 px-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-lockup.svg" alt="GoHybrid" className="h-8 w-auto" />
        </div>

        <ul className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus ${
                  isActive(pathname, href)
                    ? "bg-surface-2 text-ink"
                    : "text-ink-subtle hover:bg-surface-1 hover:text-ink active:bg-surface-1 active:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <span className="truncate px-3 text-xs text-ink-subtle">
            {userEmail}
          </span>
          <form action={signOutAction}>
            <SubmitButton className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-subtle hover:bg-surface-1 hover:text-ink active:bg-surface-1 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
              <LogOut className="h-4 w-4" />
              Sign out
            </SubmitButton>
          </form>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-canvas sm:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus ${
              isActive(pathname, href)
                ? "text-ink"
                : "text-ink-subtle active:bg-surface-1 active:text-ink"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
