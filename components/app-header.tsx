"use client";

import { BookOpenText, CircleHelp, ClipboardList, ListChecks, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import Image from "next/image";
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
    "flex min-h-9 items-center gap-2 rounded-full px-3.5 text-sm font-bold text-muted-foreground no-underline transition-colors hover:bg-surface-soft hover:text-navy max-sm:w-10 max-sm:justify-center max-sm:px-0",
    active && "bg-accent text-primary-strong hover:bg-accent"
  );

  return (
    <>
      <div className={cn("bg-navy text-center text-xs font-bold text-white", isSignIn ? "h-2 overflow-hidden" : "min-h-7 px-4 py-1.5 max-sm:min-h-6 max-sm:px-2 max-sm:py-1 max-sm:text-[10px]")} role="status">
        <span className={cn(isSignIn && "sr-only")}>Sanitized pilot sandbox. Real child data is disabled.</span>
      </div>
      <header className="relative z-30 border-b border-border bg-surface">
        <div className={cn("mx-auto flex items-center gap-6", isSignIn ? "min-h-[54px] w-full justify-center" : "min-h-[66px] w-[min(calc(100%-40px),1180px)] justify-between max-sm:min-h-[58px] max-sm:w-[min(calc(100%-24px),1120px)] max-sm:gap-2")}>
          <Link className="inline-flex min-w-0 items-center gap-3 text-navy no-underline" href={visibleUser?.role === "ADMIN" ? "/admin/access" : visibleUser ? "/children" : "/"}>
            <Image
              alt="Shine Early Learning"
              className="h-10 w-auto shrink-0"
              height={345}
              priority
              src="/brand/shine-early-learning-logo.png"
              width={1007}
            />
            <span className={cn("border-l border-border-strong pl-3 font-heading text-[15px] font-bold leading-[1.05]", !isSignIn && "max-[900px]:hidden")}>
              <span className="block">HELP®</span>
              <span className="mt-1 block font-sans text-[10px] font-semibold leading-none text-muted-foreground">AI Crediting Companion</span>
            </span>
          </Link>
          {visibleUser ? (
            <div className="flex items-center gap-2 max-sm:gap-1">
              <nav aria-label="Primary navigation" className="flex items-center gap-1">
                {visibleUser.role === "EDUCATOR" ? (
                  <>
                    <Link aria-current={pathname.startsWith("/children") ? "page" : undefined} aria-label="Children" className={navClass(pathname.startsWith("/children"))} href="/children"><UsersRound aria-hidden="true" size={18} /><span className="max-sm:sr-only">Children</span></Link>
                    <Link aria-current={pathname.startsWith("/assessments") ? "page" : undefined} aria-label="Assessments" className={navClass(pathname.startsWith("/assessments"))} href="/assessments"><ClipboardList aria-hidden="true" size={18} /><span className="max-sm:sr-only">Assessments</span></Link>
                  </>
                ) : (
                  <>
                    <Link aria-current={pathname === "/admin/access" ? "page" : undefined} aria-label="Access" className={navClass(pathname === "/admin/access")} href="/admin/access"><ShieldCheck aria-hidden="true" size={18} /><span className="max-sm:sr-only">Access</span></Link>
                    <Link aria-current={pathname === "/admin/children" ? "page" : undefined} aria-label="Children" className={navClass(pathname === "/admin/children")} href="/admin/children"><UsersRound aria-hidden="true" size={18} /><span className="max-sm:sr-only">Children</span></Link>
                    <Link aria-current={pathname === "/admin/catalog" ? "page" : undefined} aria-label="Catalogue" className={navClass(pathname === "/admin/catalog")} href="/admin/catalog"><BookOpenText aria-hidden="true" size={18} /><span className="max-sm:sr-only">Catalogue</span></Link>
                    <Link aria-current={pathname === "/admin/jobs" ? "page" : undefined} aria-label="Jobs" className={navClass(pathname === "/admin/jobs")} href="/admin/jobs"><ListChecks aria-hidden="true" size={18} /><span className="max-sm:sr-only">Jobs</span></Link>
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
