"use client";

import { CircleHelp, ClipboardCheck, ClipboardList, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SessionUser } from "@/lib/help-review/models";
import { SUPPORT_CONTACT_HREF } from "@/lib/help-review/support-contact";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const isSignIn = pathname === "/sign-in";

  useEffect(() => {
    if (pathname === "/sign-in" || pathname === "/") return;
    void fetch("/api/session", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setUser((await response.json()).user as SessionUser);
      else setUser(null);
    }).catch(() => setUser(null));
  }, [pathname]);

  const visibleUser = isSignIn ? null : user;

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

  const navClass = (active: boolean) => cn(
    "flex min-h-[42px] items-center gap-2 border-b-2 border-transparent px-3 text-sm font-bold text-muted-foreground no-underline transition-colors hover:text-navy max-sm:px-2 max-sm:text-xs max-sm:[&_svg]:hidden",
    active && "border-primary text-primary-strong"
  );

  return (
    <>
      <div className={cn("bg-navy text-center text-xs font-bold text-white", isSignIn ? "h-2 overflow-hidden" : "min-h-7 px-4 py-1.5 max-sm:min-h-6 max-sm:px-2 max-sm:py-1 max-sm:text-[10px]")} role="status">
        <span className={cn(isSignIn && "sr-only")}>Sanitized pilot sandbox. Real child data is disabled.</span>
      </div>
      <header className="relative z-30 border-b border-border bg-white/98">
        <div className={cn("mx-auto flex items-center gap-6", isSignIn ? "min-h-[54px] w-full justify-center" : "min-h-[66px] w-[min(calc(100%-40px),1180px)] justify-between max-sm:min-h-[58px] max-sm:w-[min(calc(100%-24px),1120px)] max-sm:gap-2")}>
          <Link
            className={cn("inline-flex items-center gap-2 font-heading font-bold text-navy no-underline", isSignIn ? "text-[17px]" : "text-xl max-sm:text-[17px]")}
            href={visibleUser?.role === "ADMIN" ? "/admin/access" : visibleUser ? "/children" : "/"}
          >
            <ClipboardCheck aria-hidden="true" className="text-primary" size={isSignIn ? 18 : 22} strokeWidth={2.2} />
            <span>HELP Review</span>
          </Link>
          {visibleUser ? (
            <div className="flex items-center gap-2 max-sm:gap-1">
              <nav aria-label="Primary navigation" className="flex self-stretch">
                {visibleUser.role === "EDUCATOR" ? (
                  <>
                    <Link aria-current={pathname.startsWith("/children") ? "page" : undefined} className={navClass(pathname.startsWith("/children"))} href="/children"><UsersRound aria-hidden="true" size={17} />Children</Link>
                    <Link aria-current={pathname.startsWith("/assessments") ? "page" : undefined} className={navClass(pathname.startsWith("/assessments"))} href="/assessments"><ClipboardList aria-hidden="true" size={17} />Assessments</Link>
                  </>
                ) : (
                  <>
                    <Link aria-current={pathname === "/admin/access" ? "page" : undefined} className={navClass(pathname === "/admin/access")} href="/admin/access"><ShieldCheck aria-hidden="true" size={17} />Access</Link>
                    <Link aria-current={pathname === "/admin/jobs" ? "page" : undefined} className={navClass(pathname === "/admin/jobs")} href="/admin/jobs">Jobs</Link>
                  </>
                )}
              </nav>
              {SUPPORT_CONTACT_HREF ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild className="max-sm:hidden" size="icon" variant="outline">
                      <a aria-label="Contact pilot support" href={SUPPORT_CONTACT_HREF}><CircleHelp aria-hidden="true" size={18} /></a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Contact pilot support</TooltipContent>
                </Tooltip>
              ) : null}
              <span className="ml-3 text-[13px] text-muted-foreground max-md:hidden">{visibleUser.displayName}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Sign out" onClick={signOut} size="icon" type="button" variant="outline"><LogOut aria-hidden="true" size={18} /></Button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}
