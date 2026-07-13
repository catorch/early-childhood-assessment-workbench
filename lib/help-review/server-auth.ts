/** Test identity adapter used only with sanitized local pilot records. */

import type { NextRequest } from "next/server";

import type { PilotState, PilotUser, Role } from "./models";
import { readPilotState } from "./server-store";

export const SESSION_COOKIE = "help_review_sandbox_user";

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404 = 404
  ) {
    super(message);
  }
}

export function activeUserFromState(request: NextRequest, state: PilotState): PilotUser {
  const userId = request.cookies.get(SESSION_COOKIE)?.value;
  const user = state.users.find((candidate) => candidate.id === userId && candidate.isActive);
  if (!user) throw new AccessError("A valid sandbox session is required.", 401);
  const activeProvision = state.access.some((provision) => provision.userId === user.id && provision.active);
  if (!activeProvision) throw new AccessError("Pilot access is inactive.", 401);
  return user;
}

export async function requireActiveUser(request: NextRequest, role?: Role): Promise<PilotUser> {
  const state = await readPilotState();
  const user = activeUserFromState(request, state);
  if (role && user.role !== role) throw new AccessError("The requested resource is unavailable.");
  return user;
}

export function hasActiveAssignment(state: PilotState, educatorId: string, childId: string): boolean {
  return state.assignments.some(
    (assignment) => assignment.educatorId === educatorId && assignment.childId === childId && assignment.active
  );
}

export function requireChildAssignment(state: PilotState, educatorId: string, childId: string): void {
  if (!hasActiveAssignment(state, educatorId, childId)) {
    throw new AccessError("The requested resource is unavailable.");
  }
}
