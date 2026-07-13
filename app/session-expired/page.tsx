import { ClockAlert, LogIn } from "lucide-react";
import Link from "next/link";

function safeReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/children";
}

export default async function SessionExpiredPage({
  searchParams
}: {
  readonly searchParams: Promise<{ readonly returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  return (
    <main className="center-state-shell">
      <section className="session-state" aria-labelledby="session-title">
        <span className="session-state-icon"><ClockAlert aria-hidden="true" /></span>
        <span className="eyebrow">Protected session</span>
        <h1 id="session-title">Your session expired</h1>
        <p>Sign in again to continue. Your saved assessment work is still available.</p>
        <Link className="button primary icon-text" href={`/sign-in?reason=expired&returnTo=${encodeURIComponent(returnTo)}`}>
          <LogIn aria-hidden="true" size={17} /> Sign in again
        </Link>
        <Link className="text-link" href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
