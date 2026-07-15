import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import type { PilotState, PilotUser } from "./models";
import { updatePilotState } from "./server-store";

export interface VerifiedIdentityPlatformUser {
  readonly subject: string;
  readonly email: string;
}

export interface IdentityPlatformVerifier {
  verify(idToken: string): Promise<VerifiedIdentityPlatformUser>;
}

export interface IdentityPlatformAdminClient {
  getUser(uid: string): Promise<{ readonly uid: string; readonly email?: string; readonly disabled: boolean }>;
  getUserByEmail(email: string): Promise<{ readonly uid: string; readonly email?: string; readonly disabled: boolean }>;
  createUser(properties: {
    readonly email: string;
    readonly displayName: string;
    readonly disabled: boolean;
    readonly emailVerified: boolean;
  }): Promise<{ readonly uid: string; readonly email?: string; readonly disabled: boolean }>;
  updateUser(uid: string, properties: { readonly disabled: boolean }): Promise<unknown>;
}

function projectId(environment: NodeJS.ProcessEnv): string {
  const value = environment.HELP_REVIEW_IDENTITY_PLATFORM_PROJECT_ID ?? environment.GOOGLE_CLOUD_PROJECT;
  if (!value) throw new Error("Identity Platform project configuration is unavailable.");
  return value;
}

function firebaseApp(environment: NodeJS.ProcessEnv): App {
  const selectedProject = projectId(environment);
  const name = `help-review-${selectedProject}`;
  const existing = getApps().find((candidate) => candidate.name === name);
  return existing ?? initializeApp({
    credential: applicationDefault(),
    projectId: selectedProject
  }, name);
}

function adminClient(environment: NodeJS.ProcessEnv = process.env): IdentityPlatformAdminClient {
  return getAuth(firebaseApp(environment));
}

function authErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export async function ensureIdentityPlatformAccount(
  email: string,
  displayName: string,
  client: IdentityPlatformAdminClient = adminClient()
): Promise<{ readonly uid: string; readonly created: boolean }> {
  const exactEmail = email.trim().toLowerCase();
  try {
    const existing = await client.getUserByEmail(exactEmail);
    return { uid: existing.uid, created: false };
  } catch (error) {
    if (authErrorCode(error) !== "auth/user-not-found") throw error;
  }
  const created = await client.createUser({
    email: exactEmail,
    displayName: displayName.trim(),
    disabled: false,
    emailVerified: false
  });
  return { uid: created.uid, created: true };
}

export async function setIdentityPlatformAccountEnabled(
  identity: { readonly externalSubject: string; readonly email: string },
  enabled: boolean,
  client: IdentityPlatformAdminClient = adminClient()
): Promise<void> {
  const prefix = "identity-platform:";
  let user: Awaited<ReturnType<IdentityPlatformAdminClient["getUser"]>>;
  try {
    user = identity.externalSubject.startsWith(prefix)
      ? await client.getUser(identity.externalSubject.slice(prefix.length))
      : await client.getUserByEmail(identity.email.trim().toLowerCase());
  } catch (error) {
    if (!enabled && authErrorCode(error) === "auth/user-not-found") return;
    throw error;
  }
  await client.updateUser(user.uid, { disabled: !enabled });
}

export function createIdentityPlatformVerifier(
  environment: NodeJS.ProcessEnv = process.env
): IdentityPlatformVerifier {
  return {
    async verify(idToken) {
      if (idToken.length < 100 || idToken.length > 16 * 1024) {
        throw new Error("Identity token is malformed.");
      }
      const decoded = await getAuth(firebaseApp(environment)).verifyIdToken(idToken, true);
      const email = decoded.email?.trim().toLowerCase();
      if (
        !email ||
        decoded.email_verified !== true ||
        decoded.firebase?.sign_in_provider !== "password"
      ) {
        throw new Error("Identity token does not satisfy the selected provider contract.");
      }
      return {
        subject: `identity-platform:${decoded.uid}`,
        email
      };
    }
  };
}

/** Links a verified provider UID only to the exact, active email provisioned by an Admin. */
export function linkIdentityPlatformUser(
  state: PilotState,
  verified: VerifiedIdentityPlatformUser
): PilotUser | null {
  const exactEmail = verified.email.trim().toLowerCase();
  const existingBySubject = state.users.find((user) => user.externalSubject === verified.subject);
  if (existingBySubject) {
    const provision = state.access.find((candidate) =>
      candidate.userId === existingBySubject.id &&
      candidate.active &&
      candidate.exactEmail.toLowerCase() === exactEmail &&
      candidate.role === existingBySubject.role
    );
    return existingBySubject.isActive && provision ? existingBySubject : null;
  }

  const provision = state.access.find((candidate) =>
    candidate.active && candidate.exactEmail.toLowerCase() === exactEmail
  );
  if (!provision) return null;
  const provisionedUser = state.users.find((user) => user.id === provision.userId);
  if (!provisionedUser || !provisionedUser.isActive || provisionedUser.role !== provision.role) return null;
  if (state.users.some((user) => user.id !== provisionedUser.id && user.email.toLowerCase() === exactEmail)) {
    return null;
  }

  const linkedUser: PilotUser = {
    ...provisionedUser,
    externalSubject: verified.subject,
    email: exactEmail
  };
  state.users = state.users.map((user) => user.id === linkedUser.id ? linkedUser : user);
  return linkedUser;
}

export interface IdentityPlatformAuthenticationDependencies {
  readonly verifier: IdentityPlatformVerifier;
  readonly updateState: typeof updatePilotState;
}

export async function authenticateIdentityPlatformUser(
  idToken: string,
  dependencies: IdentityPlatformAuthenticationDependencies = {
    verifier: createIdentityPlatformVerifier(),
    updateState: updatePilotState
  }
): Promise<PilotUser | null> {
  const verified = await dependencies.verifier.verify(idToken);
  return dependencies.updateState((state) => linkIdentityPlatformUser(state, verified));
}
