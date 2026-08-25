import { signOut } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth";
import Nav from "./Nav";

/**
 * Shell for every authenticated route (GOHYBRID_PLAN.md §5A): renders the
 * top-level Nav once and reserves space for it around the page content — a
 * left gutter for the desktop sidebar, a bottom gutter for the mobile bar
 * — so no individual page has to account for the nav's fixed positioning.
 * Every route under this (app) group requires a signed-in user; (auth)'s
 * /login and /register sit outside this group and render full-screen with
 * no navigation at all.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <Nav userEmail={user.email ?? ""} signOutAction={signOut} />
      <div className="pb-16 sm:pb-0 sm:pl-56">{children}</div>
    </>
  );
}
