import { cookies } from "next/headers";

import { SESSION_COOKIE } from "./server-auth";
import { readPilotState } from "./server-store";

/** Resolves the first authorized workspace without exposing protected records. */
export async function resolvePilotHome(): Promise<"/sign-in" | "/children" | "/admin/access"> {
  try {
    const userId = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!userId) return "/sign-in";
    const state = await readPilotState();
    const user = state.users.find((candidate) => candidate.id === userId && candidate.isActive);
    const hasAccess = state.access.some((provision) => provision.userId === user?.id && provision.active);
    if (!user || !hasAccess) return "/sign-in";
    return user.role === "ADMIN" ? "/admin/access" : "/children";
  } catch {
    return "/sign-in";
  }
}
