import { EyeOff, Undo2 } from "lucide-react";
import Link from "next/link";

import { Sparkle } from "@/components/brand";
import { Eyebrow } from "@/components/ui/app-patterns";
import { Button } from "@/components/ui/button";
import { resolvePilotHome } from "@/lib/help-review/server-navigation";

export default async function ResourceUnavailablePage() {
  const destination = await resolvePilotHome();
  const destinationLabel = destination === "/admin/access"
    ? "Return to pilot access"
    : destination === "/children"
      ? "Return to assigned children"
      : "Return to sign in";
  return (
    <main className="grid min-h-[calc(100vh-94px)] place-items-center px-5 py-12">
      <section className="w-full max-w-[620px] rounded-3xl border border-border bg-surface px-8 py-14 text-center shadow-card" aria-labelledby="unavailable-title">
        <span className="relative mx-auto mb-5 grid w-fit">
          <span className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning"><EyeOff aria-hidden="true" /></span>
          <Sparkle className="absolute -top-1 -right-3 size-3.5 text-brand-yellow" />
        </span>
        <Eyebrow>Protected record</Eyebrow>
        <h1 className="mt-2.5 font-heading text-4xl font-bold text-ink max-sm:text-[29px]" id="unavailable-title">This record is not available</h1>
        <p className="mx-auto mt-3 max-w-[520px] leading-relaxed text-muted-foreground">It may have moved, expired, or not be assigned to your account.</p>
        <Button asChild className="mt-7"><Link href={destination}><Undo2 aria-hidden="true" size={17} /> {destinationLabel}</Link></Button>
      </section>
    </main>
  );
}
