/** First-party email/password credentials: scrypt hashing plus single-use invite and reset tokens. */

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";

import type { PilotState, PilotUser, StaffAuthToken } from "./models";

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;
export const INVITE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const RESET_TOKEN_TTL_SECONDS = 2 * 60 * 60;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (error, derived) => (error ? reject(error) : resolve(derived))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  return [
    "scrypt",
    `${SCRYPT_COST}.${SCRYPT_BLOCK_SIZE}.${SCRYPT_PARALLELIZATION}`,
    salt.toString("base64url"),
    key.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, parameters, saltEncoded, keyEncoded] = storedHash.split("$");
  if (scheme !== "scrypt" || !parameters || !saltEncoded || !keyEncoded) return false;
  const [cost, blockSize, parallelization] = parameters.split(".").map(Number);
  if (!cost || !blockSize || !parallelization) return false;
  const salt = Buffer.from(saltEncoded, "base64url");
  const expected = Buffer.from(keyEncoded, "base64url");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, expected.length, { N: cost, r: blockSize, p: parallelization },
      (error, key) => (error ? reject(error) : resolve(key)));
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function hashAuthToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("base64url");
}

/** Creates a single-use token, invalidating the user's other unused tokens, and returns the raw secret once. */
export function issueAuthToken(
  state: PilotState,
  input: {
    readonly userId: string;
    readonly purpose: StaffAuthToken["purpose"];
    readonly createdById: string;
    readonly now?: Date;
  }
): { readonly rawToken: string; readonly record: StaffAuthToken } {
  const now = input.now ?? new Date();
  const rawToken = randomBytes(32).toString("base64url");
  const ttlSeconds = input.purpose === "INVITE" ? INVITE_TOKEN_TTL_SECONDS : RESET_TOKEN_TTL_SECONDS;
  const record: StaffAuthToken = {
    id: `auth-token-${randomUUID()}`,
    userId: input.userId,
    purpose: input.purpose,
    tokenHash: hashAuthToken(rawToken),
    createdById: input.createdById,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1_000).toISOString(),
    usedAt: null
  };
  state.authTokens ??= [];
  for (const existing of state.authTokens) {
    if (existing.userId === input.userId && existing.usedAt === null) existing.usedAt = now.toISOString();
  }
  state.authTokens.push(record);
  return { rawToken, record };
}

/** Resolves an unused, unexpired token to its active provisioned user; returns null without disclosing why. */
export function resolveAuthToken(
  state: PilotState,
  rawToken: string,
  now = new Date()
): { readonly token: StaffAuthToken; readonly user: PilotUser } | null {
  const tokenHash = hashAuthToken(rawToken);
  const token = (state.authTokens ?? []).find((candidate) => candidate.tokenHash === tokenHash);
  if (!token || token.usedAt !== null || new Date(token.expiresAt).getTime() <= now.getTime()) return null;
  const user = state.users.find((candidate) => candidate.id === token.userId && candidate.isActive);
  if (!user) return null;
  const provision = state.access.some((candidate) => candidate.userId === user.id && candidate.active);
  return provision ? { token, user } : null;
}

/** Stores or replaces the user's password hash and consumes every outstanding token. */
export function applyPassword(state: PilotState, userId: string, passwordHash: string, now = new Date()): void {
  state.credentials ??= [];
  const existing = state.credentials.find((candidate) => candidate.userId === userId);
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.updatedAt = now.toISOString();
  } else {
    state.credentials.push({ userId, passwordHash, updatedAt: now.toISOString() });
  }
  for (const token of state.authTokens ?? []) {
    if (token.userId === userId && token.usedAt === null) token.usedAt = now.toISOString();
  }
}

/** Verifies email/password against active provisioned users. One null result covers every failure mode. */
export async function authenticateEmailPassword(
  state: PilotState,
  email: string,
  password: string
): Promise<PilotUser | null> {
  const exactEmail = email.trim().toLowerCase();
  const user = state.users.find((candidate) => candidate.email.toLowerCase() === exactEmail && candidate.isActive);
  const credential = user
    ? (state.credentials ?? []).find((candidate) => candidate.userId === user.id)
    : undefined;
  const provisioned = user
    ? state.access.some((candidate) => candidate.userId === user.id && candidate.active)
    : false;
  // Always burn one hash verification so missing accounts are not distinguishable by timing.
  const storedHash = credential?.passwordHash
    ?? "scrypt$16384.8.1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = await verifyPassword(password, storedHash);
  if (!user || !credential || !provisioned || !valid) return null;
  return user;
}

export function credentialSummary(state: PilotState, userId: string, now = new Date()): {
  readonly hasPassword: boolean;
  readonly invitePending: boolean;
} {
  const hasPassword = (state.credentials ?? []).some((candidate) => candidate.userId === userId);
  const invitePending = (state.authTokens ?? []).some(
    (candidate) =>
      candidate.userId === userId &&
      candidate.usedAt === null &&
      new Date(candidate.expiresAt).getTime() > now.getTime()
  );
  return { hasPassword, invitePending };
}
