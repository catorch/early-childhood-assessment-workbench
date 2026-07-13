import { redirect } from "next/navigation";

import { resolvePilotHome } from "@/lib/help-review/server-navigation";

export default async function HomePage() {
  redirect(await resolvePilotHome());
}
