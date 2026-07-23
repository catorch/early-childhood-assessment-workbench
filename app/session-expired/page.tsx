import { ClockAlert, LogIn } from "lucide-react";
import Link from "next/link";

import { Sparkle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/app-patterns";
import { safeRelativeReturnPath } from "@/lib/help-review/return-path";

function safeReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return safeRelativeReturnPath(candidate, "/children");
}

export default async function SessionExpiredPage({
  searchParams
}: {
  readonly searchParams: Promise<{ readonly returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  return (
    <main className="grid min-h-[calc(100vh-94px)] place-items-center px-5 py-12">
      <section className="w-full max-w-[620px] rounded-3xl border border-border bg-surface px-8 py-14 text-center shadow-card" aria-labelledby="session-title">
        <span className="relative mx-auto mb-5 grid w-fit">
          <span className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning"><ClockAlert aria-hidden="true" /></span>
          <Sparkle className="absolute -top-1 -right-3 size-3.5 text-brand-yellow" />
        </span>
        <Eyebrow>Protected session</Eyebrow>
        <h1 className="mt-2.5 font-heading text-4xl font-bold text-ink max-sm:text-[29px]" id="session-title">Your session expired</h1>
        <p className="mx-auto mt-3 max-w-[520px] leading-relaxed text-muted-foreground">Sign in again to continue. Your saved assessment work is still available.</p>
        <Button asChild className="mt-7">
          <Link href={`/sign-in?reason=expired&returnTo=${encodeURIComponent(returnTo)}`}><LogIn aria-hidden="true" size={17} /> Sign in again</Link>
        </Button>
        <Link className="mt-6 block font-bold text-primary-strong underline-offset-4 hover:underline" href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
