import { EyeOff, Undo2 } from "lucide-react";
import Link from "next/link";

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
      <section className="w-full max-w-[620px] border-y border-border py-14 text-center" aria-labelledby="unavailable-title">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-warning-soft text-warning"><EyeOff aria-hidden="true" /></span>
        <Eyebrow>Protected record</Eyebrow>
        <h1 className="mt-2 font-heading text-4xl font-normal text-ink max-sm:text-[29px]" id="unavailable-title">This record is not available</h1>
        <p className="mx-auto mt-3 max-w-[520px] leading-relaxed text-muted-foreground">It may have moved, expired, or not be assigned to your account.</p>
        <Button asChild className="mt-7"><Link href={destination}><Undo2 aria-hidden="true" size={17} /> {destinationLabel}</Link></Button>
      </section>
    </main>
  );
}
