"use client";

import { ArrowRight, GraduationCap, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type SandboxUserId = "user-educator-1" | "user-educator-2" | "user-admin-1";

const profiles: ReadonlyArray<{
  readonly id: SandboxUserId;
  readonly label: string;
  readonly detail: string;
  readonly destination: string;
  readonly icon: typeof GraduationCap;
  readonly tone: string;
}> = [
  {
    id: "user-educator-1",
    label: "Alex Morgan",
    detail: "Educator with assigned children",
    destination: "/children",
    icon: GraduationCap,
    tone: "educator"
  },
  {
    id: "user-educator-2",
    label: "Jordan Lee",
    detail: "Educator access and assignment state",
    destination: "/children",
    icon: UserRound,
    tone: "educator-secondary"
  },
  {
    id: "user-admin-1",
    label: "Casey Rivera",
    detail: "Pilot access administrator",
    destination: "/admin/access",
    icon: ShieldCheck,
    tone: "admin"
  }
];

function safeReturnPath(defaultPath: string): string {
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : defaultPath;
}

export default function SignInPage() {
  const router = useRouter();
  const [pending, setPending] = useState<SandboxUserId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const reason = new URLSearchParams(window.location.search).get("reason");
      if (reason === "expired") setError("Your session ended. Sign in again to continue securely.");
      if (reason === "unavailable") setError("We could not confirm access. Try again or contact the pilot administrator.");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function signIn(userId: SandboxUserId, destination: string) {
    setPending(userId);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        setError("We could not confirm access. Try again or contact the pilot administrator.");
        setPending(null);
        return;
      }
      router.push(safeReturnPath(destination));
      router.refresh();
    } catch {
      setError("We could not confirm access. Try again or contact the pilot administrator.");
      setPending(null);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-62px)] place-items-center px-5 py-12 max-sm:min-h-[calc(100vh-62px)] max-sm:px-3 max-sm:py-6">
      <section className="w-full max-w-[420px] border border-border bg-surface px-7 py-7 shadow-[0_12px_32px_rgba(24,59,86,.08)] max-sm:px-5 max-sm:py-6" aria-labelledby="sign-in-title">
        <div className="grid size-[38px] place-items-center rounded-md bg-navy text-[#b9d5df]" aria-hidden="true"><ShieldCheck size={20} /></div>
        <p className="mt-4 text-[9px] font-extrabold uppercase text-primary-strong">HELP Review pilot</p>
        <h1 className="mt-1 font-heading text-[32px] font-normal leading-tight text-ink" id="sign-in-title">Sign in</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choose an approved sanitized staff profile.</p>
        {error ? <Alert className="mt-[18px] px-3 py-3 text-[13px]" variant="destructive"><AlertDescription className="text-[13px] leading-relaxed">{error}</AlertDescription></Alert> : null}
        <div className="mt-5 grid gap-2.5" aria-label="Sandbox profiles">
          {profiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <button
                className="group grid min-h-[62px] w-full grid-cols-[38px_minmax(0,1fr)_20px] items-center gap-3 rounded-md border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={pending !== null}
                key={profile.id}
                onClick={() => signIn(profile.id, profile.destination)}
                type="button"
              >
                <span className={cn("grid size-[38px] place-items-center rounded-md", profile.tone === "admin" ? "bg-warning-soft text-warning" : profile.tone === "educator-secondary" ? "bg-info-soft text-info" : "bg-accent text-primary-strong")}><Icon aria-hidden="true" size={19} /></span>
                <span className="grid min-w-0 gap-0.5"><strong className="truncate text-sm text-ink">{profile.label}</strong><small className="truncate text-[11px] text-muted-foreground">{profile.detail}</small></span>
                <ArrowRight aria-hidden="true" className="text-navy transition-transform group-hover:translate-x-0.5 group-hover:text-primary" size={19} />
              </button>
            );
          })}
        </div>
        <p className="mt-[18px] flex items-center gap-1.5 text-[10px] text-muted-foreground"><ShieldCheck aria-hidden="true" size={13} /> Pilot access is provisioned by an administrator.</p>
      </section>
    </main>
  );
}
