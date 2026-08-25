"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, Home, LogOut, User } from "lucide-react";

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
 * Top-level navigation (GOHYBRID_PLAN.md §5A): a persistent left sidebar on
 * desktop (sm and up) and a fixed bottom bar on mobile, both driven by the
 * same NAV_ITEMS list so the two platforms can't drift out of sync — only
 * the surrounding markup and classes differ per breakpoint. Sign-out lives
 * only in the sidebar; on mobile it lives on /profile instead.
 */
export default function Nav({ userEmail, signOutAction }: NavProps) {
  const pathname = usePathname();

  return (
    <>
      <nav className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-gray-200 bg-white p-4 sm:flex">
        <span className="mb-6 px-3 text-lg font-semibold">GoHybrid</span>

        <ul className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm ${
                  isActive(pathname, href)
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
          <span className="truncate px-3 text-xs text-gray-500">
            {userEmail}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-white sm:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              isActive(pathname, href) ? "text-black" : "text-gray-500"
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
