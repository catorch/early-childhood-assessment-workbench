"use client";

import { AlertCircle, ArrowRight, GraduationCap, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eyebrow } from "@/components/ui/app-patterns";
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
    <main className="mx-auto grid min-h-[calc(100vh-94px)] w-[min(calc(100%_-_40px),760px)] place-items-center py-16 max-sm:w-[min(calc(100%_-_24px),760px)] max-sm:py-12">
      <section className="w-full border-y border-border py-12" aria-labelledby="sign-in-title">
        <div className="mb-5 grid size-12 place-items-center rounded-full bg-accent text-primary" aria-hidden="true"><ShieldCheck /></div>
        <Eyebrow>HELP Review pilot</Eyebrow>
        <h1 className="mt-2 font-heading text-[46px] font-bold leading-tight text-ink max-sm:text-4xl" id="sign-in-title">Sign in</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">Choose an approved sanitized staff profile.</p>
        {error ? <Alert className="mt-7" variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{error}</AlertDescription></Alert> : null}
        <div className="mt-8 grid gap-3" aria-label="Sandbox profiles">
          {profiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <button
                className="group grid w-full grid-cols-[46px_1fr_auto] items-center gap-3.5 rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55 max-sm:grid-cols-[42px_1fr_auto] max-sm:p-3.5"
                disabled={pending !== null}
                key={profile.id}
                onClick={() => signIn(profile.id, profile.destination)}
                type="button"
              >
                <span className={cn("grid size-[46px] place-items-center rounded-full max-sm:size-[42px]", profile.tone === "admin" ? "bg-warning-soft text-warning" : "bg-accent text-primary-strong")}><Icon aria-hidden="true" /></span>
                <span className="grid min-w-0 gap-1"><strong className="text-ink">{profile.label}</strong><small className="text-[13px] text-muted-foreground">{profile.detail}</small></span>
                <ArrowRight aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </button>
            );
          })}
        </div>
        <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" size={14} /> Pilot access is provisioned by an administrator.</p>
      </section>
    </main>
  );
}
