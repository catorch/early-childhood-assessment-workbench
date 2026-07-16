/** Signed application sessions and authorization for each selected identity boundary. */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import type { PilotState, PilotUser, Role } from "./models";
import { readPilotState } from "./server-store";

export const SESSION_COOKIE = "help_review_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export type IdentityAdapterName = "sandbox" | "email-password";

interface SessionClaims {
  readonly version: 2;
  readonly issuer: IdentityAdapterName;
  readonly subject: string;
  readonly sessionId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface IdentityAdapter {
  readonly name: IdentityAdapterName;
  readonly sessionMaxAgeSeconds: number;
  issue(userId: string, now?: Date): string;
  resolve(token: string | undefined, now?: Date): SessionClaims | null;
}

function sessionSecret(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.HELP_REVIEW_SESSION_SECRET;
  if (configured) return configured;
  if (environment.NODE_ENV === "production") {
    throw new Error("HELP_REVIEW_SESSION_SECRET is required in production.");
  }
  return "help-review-local-session-secret-not-for-production";
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string, secret = sessionSecret()): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function equalSignature(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

class SignedSessionIdentityAdapter implements IdentityAdapter {
  constructor(
    readonly name: IdentityAdapterName,
    readonly sessionMaxAgeSeconds: number
  ) {}

  issue(userId: string, now = new Date()): string {
    const issuedAt = Math.floor(now.getTime() / 1_000);
    const claims: SessionClaims = {
      version: 2,
      issuer: this.name,
      subject: userId,
      sessionId: randomUUID(),
      issuedAt,
      expiresAt: issuedAt + this.sessionMaxAgeSeconds
    };
    const payload = encode(JSON.stringify(claims));
    return `${payload}.${signature(payload)}`;
  }

  resolve(token: string | undefined, now = new Date()): SessionClaims | null {
    if (!token) return null;
    const [payload, suppliedSignature, extra] = token.split(".");
    if (!payload || !suppliedSignature || extra || !equalSignature(signature(payload), suppliedSignature)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionClaims>;
      const current = Math.floor(now.getTime() / 1_000);
      if (
        claims.version !== 2 ||
        claims.issuer !== this.name ||
        typeof claims.subject !== "string" ||
        typeof claims.sessionId !== "string" ||
        typeof claims.issuedAt !== "number" ||
        typeof claims.expiresAt !== "number" ||
        claims.issuedAt > current + 60 ||
        claims.expiresAt <= current ||
        claims.expiresAt - claims.issuedAt > this.sessionMaxAgeSeconds
      ) return null;
      return claims as SessionClaims;
    } catch {
      return null;
    }
  }
}

export class SandboxIdentityAdapter extends SignedSessionIdentityAdapter {
  constructor() {
    super("sandbox", SESSION_MAX_AGE_SECONDS);
  }
}

export class EmailPasswordIdentityAdapter extends SignedSessionIdentityAdapter {
  constructor() {
    super("email-password", SESSION_MAX_AGE_SECONDS);
  }
}

export const sandboxIdentity = new SandboxIdentityAdapter();
export const emailPasswordIdentity = new EmailPasswordIdentityAdapter();

export function selectedIdentityAdapter(environment: NodeJS.ProcessEnv = process.env): IdentityAdapter {
  const selected = environment.HELP_REVIEW_IDENTITY_ADAPTER ?? "sandbox";
  if (selected === "sandbox") return sandboxIdentity;
  if (selected === "email-password") return emailPasswordIdentity;
  throw new Error("The selected identity adapter is not supported.");
}

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404 = 404
  ) {
    super(message);
  }
}

export function activeUserFromState(
  request: NextRequest,
  state: PilotState,
  identity: IdentityAdapter = selectedIdentityAdapter()
): PilotUser {
  const userId = identity.resolve(request.cookies.get(SESSION_COOKIE)?.value)?.subject;
  const user = state.users.find((candidate) => candidate.id === userId && candidate.isActive);
  if (!user) throw new AccessError("A valid session is required.", 401);
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
