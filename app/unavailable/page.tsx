import { EyeOff, Undo2 } from "lucide-react";
import Link from "next/link";

import { resolvePilotHome } from "@/lib/help-review/server-navigation";

export default async function ResourceUnavailablePage() {
  const destination = await resolvePilotHome();
  const destinationLabel = destination === "/admin/access"
    ? "Return to pilot access"
    : destination === "/children"
      ? "Return to assigned children"
      : "Return to sign in";
  return (
    <main className="center-state-shell">
      <section className="session-state unavailable-state" aria-labelledby="unavailable-title">
        <span className="session-state-icon"><EyeOff aria-hidden="true" /></span>
        <span className="eyebrow">Protected record</span>
        <h1 id="unavailable-title">This record is not available</h1>
        <p>It may have moved, expired, or not be assigned to your account.</p>
        <Link className="button primary icon-text" href={destination}><Undo2 aria-hidden="true" size={17} /> {destinationLabel}</Link>
      </section>
    </main>
  );
}
