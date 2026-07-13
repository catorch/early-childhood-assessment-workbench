"use client";

import { CircleHelp, ClipboardCheck, ClipboardList, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { PilotUser } from "@/lib/help-review/models";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PilotUser | null>(null);

  useEffect(() => {
    if (pathname === "/sign-in" || pathname === "/") return;
    void fetch("/api/session", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setUser((await response.json()).user as PilotUser);
      else setUser(null);
    }).catch(() => setUser(null));
  }, [pathname]);

  const visibleUser = pathname === "/sign-in" ? null : user;

  async function signOut() {
    try {
      await fetch("/api/session", { method: "DELETE" });
    } catch {
      // Local session state is still cleared when the network is unavailable.
    } finally {
      setUser(null);
      router.push("/sign-in");
      router.refresh();
    }
  }

  return (
    <>
      <div className="sandbox-banner" role="status">
        Sanitized pilot sandbox. Real child data is disabled.
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand-link" href={visibleUser?.role === "ADMIN" ? "/admin/access" : visibleUser ? "/children" : "/"}>
            <ClipboardCheck aria-hidden="true" size={22} strokeWidth={2.2} />
            <span>HELP Review</span>
          </Link>
          {visibleUser ? (
            <div className="header-actions">
              <nav aria-label="Primary navigation" className="primary-nav">
                {visibleUser.role === "EDUCATOR" ? (
                  <>
                    <Link className={pathname.startsWith("/children") ? "active" : ""} href="/children">
                      <UsersRound aria-hidden="true" size={17} />
                      Children
                    </Link>
                    <Link className={pathname.startsWith("/assessments") ? "active" : ""} href="/assessments">
                      <ClipboardList aria-hidden="true" size={17} />
                      Assessments
                    </Link>
                  </>
                ) : (
                  <>
                    <Link className={pathname === "/admin/access" ? "active" : ""} href="/admin/access">
                      <ShieldCheck aria-hidden="true" size={17} />
                      Access
                    </Link>
                    <Link className={pathname === "/admin/jobs" ? "active" : ""} href="/admin/jobs">
                      Jobs
                    </Link>
                  </>
                )}
              </nav>
              <a className="icon-button header-help" href="mailto:pilot-support@example.test" title="Contact pilot support">
                <CircleHelp aria-hidden="true" size={18} />
                <span className="sr-only">Contact pilot support</span>
              </a>
              <span className="user-name">{visibleUser.displayName}</span>
              <button className="icon-button" onClick={signOut} title="Sign out" type="button">
                <LogOut aria-hidden="true" size={18} />
                <span className="sr-only">Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}
