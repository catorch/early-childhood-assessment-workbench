"use client";

import { ArrowRight, GraduationCap, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <div className="auth-brand-mark" aria-hidden="true"><ShieldCheck /></div>
        <span className="eyebrow">HELP Review pilot</span>
        <h1 id="sign-in-title">Sign in</h1>
        <p>Choose an approved sanitized staff profile.</p>
        {error ? <div className="notice error auth-error" role="alert">{error}</div> : null}
        <div className="profile-options" aria-label="Sandbox profiles">
          {profiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <button
                className="profile-option"
                disabled={pending !== null}
                key={profile.id}
                onClick={() => signIn(profile.id, profile.destination)}
                type="button"
              >
                <span className={`profile-icon ${profile.tone}`}><Icon aria-hidden="true" /></span>
                <span><strong>{profile.label}</strong><small>{profile.detail}</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <p className="auth-footnote"><ShieldCheck aria-hidden="true" size={14} /> Pilot access is provisioned by an administrator.</p>
      </section>
    </main>
  );
}
