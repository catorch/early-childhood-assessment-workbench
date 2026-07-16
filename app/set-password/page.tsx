"use client";

import { Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";

const PASSWORD_MIN_LENGTH = 10;

function SetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Choose a password with at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The two password entries do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const result = await response.json() as { readonly user?: { readonly role?: string }; readonly error?: string };
      if (!response.ok || !result.user) {
        setPassword("");
        setConfirmation("");
        setError(result.error ?? "This link is no longer valid. Contact the pilot administrator for a new invitation.");
        setPending(false);
        return;
      }
      router.push(result.user.role === "ADMIN" ? "/admin/access" : "/children");
      router.refresh();
    } catch {
      setPassword("");
      setConfirmation("");
      setError("The request could not be completed. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-62px)] place-items-center px-5 py-12 max-sm:px-3 max-sm:py-6">
      <section className="w-full max-w-[420px] border border-border bg-surface px-7 py-7 shadow-[0_12px_32px_rgba(24,59,86,.08)] max-sm:px-5 max-sm:py-6" aria-labelledby="set-password-title">
        <div className="grid size-[38px] place-items-center rounded-md bg-navy text-[#b9d5df]" aria-hidden="true"><KeyRound size={20} /></div>
        <p className="mt-4 text-[9px] font-extrabold uppercase text-primary-strong">HELP Review pilot</p>
        <h1 className="mt-1 font-heading text-[32px] font-normal leading-tight text-ink" id="set-password-title">Set your password</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {token
            ? `Choose a password with at least ${PASSWORD_MIN_LENGTH} characters to finish setting up your account.`
            : "This page needs the account setup link from your invitation or reset email."}
        </p>
        {error ? <Alert className="mt-[18px] px-3 py-3 text-[13px]" ref={errorRef} tabIndex={-1} variant="destructive"><AlertDescription className="text-[13px] leading-relaxed">{error}</AlertDescription></Alert> : null}
        {token ? (
          <form className="mt-5 grid gap-4" onSubmit={submit}>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-ink" htmlFor="new-password">New password</label>
              <div className="relative">
                <input
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 pr-11 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/35"
                  disabled={pending}
                  id="new-password"
                  maxLength={256}
                  minLength={PASSWORD_MIN_LENGTH}
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
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-ink" htmlFor="confirm-password">Confirm password</label>
              <input
                autoComplete="new-password"
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/35"
                disabled={pending}
                id="confirm-password"
                maxLength={256}
                minLength={PASSWORD_MIN_LENGTH}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type={showPassword ? "text" : "password"}
                value={confirmation}
              />
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-strong focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={pending}
              type="submit"
            >
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <KeyRound aria-hidden="true" size={17} />}
              Save password and sign in
            </button>
          </form>
        ) : null}
        <p className="mt-[18px] flex items-center gap-1.5 text-[10px] text-muted-foreground"><ShieldCheck aria-hidden="true" size={13} /> Pilot access is provisioned by an administrator.</p>
      </section>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
