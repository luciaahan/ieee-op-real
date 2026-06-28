import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { committees } from "@/lib/db/schema";
import { canViewAllCommittees } from "@/lib/permissions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/meetings", label: "Meetings" },
  { href: "/search", label: "Search" },
];

export async function Nav() {
  const session = await auth();
  const allCommittees = await db
    .select({ slug: committees.slug, name: committees.name })
    .from(committees)
    .orderBy(committees.sortOrder);

  const visibleCommittees =
    session?.user && !canViewAllCommittees(session.user)
      ? allCommittees.filter((c) =>
          session.user.committeeEditScopes.includes(c.slug),
        )
      : allCommittees;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold text-[#00629B]">
          IEEE @ CMU
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[#00629B]">
              {l.label}
            </Link>
          ))}
          <details className="relative">
            <summary className="cursor-pointer hover:text-[#00629B]">
              Committees
            </summary>
            <div className="absolute right-0 z-10 mt-2 min-w-[180px] rounded border bg-white py-2 shadow-lg">
              {visibleCommittees.map((c) => (
                <Link
                  key={c.slug}
                  href={`/committees/${c.slug}`}
                  className="block px-4 py-1 hover:bg-slate-50"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </details>
          {session?.user?.canManageUsers && (
            <Link href="/admin" className="hover:text-[#00629B]">
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">
            {session?.user?.name}
          </span>
          <form action="/signout" method="POST">
            <button
              type="submit"
              className="text-slate-500 hover:text-[#C41230]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
