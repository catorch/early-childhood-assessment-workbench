"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  UserRound
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LoopLine, Sparkle } from "@/components/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeRelativeReturnPath } from "@/lib/help-review/return-path";
import { cn } from "@/lib/utils";

type SandboxUserId = "user-educator-1" | "user-educator-2" | "user-admin-1";
type IdentityConfiguration =
  | { readonly mode: "sandbox" }
  | { readonly mode: "email-password" };

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
    detail: "Admin / Supervisor",
    destination: "/admin/access",
    icon: ShieldCheck,
    tone: "admin"
  }
];

function safeReturnPath(defaultPath: string): string {
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  return safeRelativeReturnPath(candidate, defaultPath);
}

export default function SignInPage() {
  const router = useRouter();
  const [pending, setPending] = useState<SandboxUserId | null>(null);
  const [managedPending, setManagedPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<IdentityConfiguration | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const reason = new URLSearchParams(window.location.search).get("reason");
      if (reason === "expired") setError("Your session ended. Sign in again to continue securely.");
      if (reason === "unavailable") setError("We could not confirm access. Try again or contact the pilot administrator.");
      void fetch("/api/session/config", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Identity configuration unavailable.");
          return response.json() as Promise<IdentityConfiguration>;
        })
        .then((value) => {
          if (active) setConfiguration(value);
        })
        .catch(() => {
          if (active) setError("We could not start sign-in. Try again or contact the pilot administrator.");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  async function signIn(userId: SandboxUserId, destination: string) {
    setPending(userId);
    setError(null);
    setNotice(null);
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

  async function managedSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configuration?.mode !== "email-password") return;
    setManagedPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const result = await response.json() as { readonly user?: { readonly role?: string } };
      if (!response.ok || !result.user) throw new Error("Application access was not confirmed.");
      setPassword("");
      const destination = result.user.role === "ADMIN" ? "/admin/access" : "/children";
      router.push(safeReturnPath(destination));
      router.refresh();
    } catch {
      setPassword("");
      setError("We could not confirm access. Check your details, then contact the pilot administrator if needed.");
      setManagedPending(false);
    }
  }

  async function requestPasswordReset() {
    if (configuration?.mode !== "email-password" || !email.trim()) {
      setError("Enter your provisioned email address first.");
      return;
    }
    setResetPending(true);
    setError(null);
    setNotice(null);
    try {
      await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      setNotice("If this address has an account, a reset email is on its way.");
    } catch {
      setNotice("If this address has an account, a reset email is on its way.");
    } finally {
      setResetPending(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-160px)] place-items-center px-5 py-12 max-sm:px-3 max-sm:py-6">
      <div className="grid w-full max-w-[900px] grid-cols-[1.05fr_1fr] overflow-hidden rounded-3xl shadow-pop max-md:grid-cols-1">
        <section className="relative bg-primary p-10 text-white max-md:px-7 max-md:py-8" aria-label="About HELP AI Crediting Companion">
          <Sparkle className="absolute top-9 right-9 size-8 text-brand-yellow max-md:top-7 max-md:right-7 max-md:size-6" />
          <Sparkle className="absolute top-[88px] right-[76px] size-3.5 text-brand-light-blue max-md:hidden" />
          <LoopLine className="pointer-events-none absolute right-6 bottom-6 w-[150px] text-white/25 max-md:hidden" />
          <Image
            alt="Shine Early Learning"
            className="h-10 w-auto [filter:brightness(0)_invert(1)]"
            height={345}
            priority
            src="/brand/shine-early-learning-logo.png"
            width={1007}
          />
          <p className="mt-9 inline-flex items-center rounded-full bg-primary-strong px-3 py-1 text-[11px] font-extrabold tracking-[0.02em] uppercase text-white max-md:mt-6">HELP® · AI Crediting Companion</p>
          <p className="mt-3.5 max-w-[360px] font-heading text-[34px] font-bold leading-[1.12] max-md:text-[26px]">Bright moments, carefully credited.</p>
          <p className="mt-3.5 max-w-[340px] text-sm leading-relaxed text-white max-md:hidden">Upload an observation, review the AI draft, and finalize the HELP® credits you trust.</p>
        </section>
        <section className="bg-surface px-8 py-8 max-md:px-6 max-md:py-6" aria-labelledby="sign-in-title">
        <div className="grid size-[38px] place-items-center rounded-xl bg-navy text-brand-light-blue" aria-hidden="true"><ShieldCheck size={20} /></div>
        <p className="mt-4 text-[10px] font-extrabold tracking-[0.02em] uppercase text-primary-strong">HELP AI Crediting Companion</p>
        <h1 className="mt-1 font-heading text-[32px] font-bold leading-tight text-ink" id="sign-in-title">Sign in</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {configuration?.mode === "email-password"
            ? "Use your provisioned staff account."
            : configuration?.mode === "sandbox"
              ? "Choose an approved sanitized staff profile."
              : "Confirming your approved sign-in method."}
        </p>
        {error ? <Alert className="mt-[18px] px-3 py-3 text-[13px]" ref={errorRef} tabIndex={-1} variant="destructive"><AlertDescription className="text-[13px] leading-relaxed">{error}</AlertDescription></Alert> : null}
        {notice ? <Alert className="mt-[18px] px-3 py-3 text-[13px]"><AlertDescription className="text-[13px] leading-relaxed">{notice}</AlertDescription></Alert> : null}
        {configuration?.mode === "sandbox" ? (
          <div className="mt-5 grid gap-2.5" aria-label="Sandbox profiles">
            {profiles.map((profile) => {
              const Icon = profile.icon;
              return (
                <button
                  className="group grid min-h-[62px] w-full grid-cols-[38px_minmax(0,1fr)_20px] items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-primary hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={pending !== null}
                  key={profile.id}
                  onClick={() => signIn(profile.id, profile.destination)}
                  type="button"
                >
                  <span className={cn("grid size-[38px] place-items-center rounded-full", profile.tone === "admin" ? "bg-warning-soft text-warning" : profile.tone === "educator-secondary" ? "bg-info-soft text-info" : "bg-accent text-primary-strong")}><Icon aria-hidden="true" size={19} /></span>
                  <span className="grid min-w-0 gap-0.5"><strong className="truncate text-sm text-ink">{profile.label}</strong><small className="truncate text-[11px] text-muted-foreground">{profile.detail}</small></span>
                  <ArrowRight aria-hidden="true" className="text-navy transition-transform group-hover:translate-x-0.5 group-hover:text-primary" size={19} />
                </button>
              );
            })}
          </div>
        ) : configuration?.mode === "email-password" ? (
          <form className="mt-5 grid gap-4" onSubmit={managedSignIn}>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-ink" htmlFor="sign-in-email">Email</label>
              <input
                autoComplete="username"
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/35"
                disabled={managedPending}
                id="sign-in-email"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-ink" htmlFor="sign-in-password">Password</label>
              <div className="relative">
                <input
                  autoComplete="current-password"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 pr-11 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/35"
                  disabled={managedPending}
                  id="sign-in-password"
                  maxLength={4096}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-surface-soft hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/35"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
                </button>
              </div>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_2px_10px_-3px_rgba(70,94,216,.55)] hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={managedPending || resetPending}
              type="submit"
            >
              {managedPending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <LogIn aria-hidden="true" size={17} />}
              Sign in
            </button>
            <button
              className="justify-self-center text-xs font-bold text-primary-strong underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 disabled:opacity-55"
              disabled={managedPending || resetPending}
              onClick={requestPasswordReset}
              type="button"
            >
              {resetPending ? "Sending reset email..." : "Reset password"}
            </button>
          </form>
        ) : (
          <div className="mt-5 flex min-h-[82px] items-center justify-center text-muted-foreground" role="status">
            <LoaderCircle aria-hidden="true" className="animate-spin" size={22} />
            <span className="sr-only">Loading sign-in</span>
          </div>
        )}
        <p className="mt-[18px] flex items-center gap-1.5 text-[10px] text-muted-foreground"><ShieldCheck aria-hidden="true" size={13} /> Pilot access is provisioned by an administrator.</p>
        </section>
      </div>
    </main>
  );
}
