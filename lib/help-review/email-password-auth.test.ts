import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAdminAccessService } from "./admin-access-service";
import {
  applyPassword,
  authenticateEmailPassword,
  credentialSummary,
  hashPassword,
  issueAuthToken,
  resolveAuthToken,
  verifyPassword
} from "./email-password-auth";
import { createSanitizedPilotState, SANITIZED_FIXTURE_PASSWORD } from "./fixtures";
import type { PilotState } from "./models";
import { emailPasswordIdentity, sandboxIdentity, SESSION_COOKIE } from "./server-auth";

function inMemoryRepository(initial: PilotState) {
  let state = structuredClone(initial);
  return {
    readState: async () => structuredClone(state),
    updateState: async <T>(mutation: (current: PilotState) => T | Promise<T>) => {
      const next = structuredClone(state);
      const result = await mutation(next);
      state = next;
      return result;
    },
    current: () => state
  };
}

function adminRequest(identity = sandboxIdentity) {
  return new NextRequest("https://pilot.example.test/api/admin/access", {
    headers: { cookie: `${SESSION_COOKIE}=${identity.issue("user-admin-1")}` }
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("first-party password hashing", () => {
  it("verifies a hashed password and rejects wrong or tampered values", async () => {
    const hash = await hashPassword("a-strong-pilot-password");
    expect(await verifyPassword("a-strong-pilot-password", hash)).toBe(true);
    expect(await verifyPassword("a-wrong-pilot-password", hash)).toBe(false);
    expect(await verifyPassword("a-strong-pilot-password", hash.replace("scrypt", "plain"))).toBe(false);
    expect(hash).not.toContain("a-strong-pilot-password");
  });
});

describe("single-use invite and reset tokens", () => {
  it("resolves an issued token once and invalidates prior outstanding tokens", () => {
    const state = createSanitizedPilotState();
    const first = issueAuthToken(state, { userId: "user-educator-1", purpose: "INVITE", createdById: "user-admin-1" });
    const second = issueAuthToken(state, { userId: "user-educator-1", purpose: "PASSWORD_RESET", createdById: "user-admin-1" });

    expect(resolveAuthToken(state, first.rawToken)).toBeNull();
    const resolved = resolveAuthToken(state, second.rawToken);
    expect(resolved?.user.id).toBe("user-educator-1");

    applyPassword(state, "user-educator-1", "scrypt$16384.8.1$salt$hash");
    expect(resolveAuthToken(state, second.rawToken)).toBeNull();
  });

  it("rejects expired tokens and tokens for revoked access", () => {
    const state = createSanitizedPilotState();
    const issued = issueAuthToken(state, { userId: "user-educator-1", purpose: "INVITE", createdById: "user-admin-1" });
    expect(resolveAuthToken(state, issued.rawToken, new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000))).toBeNull();

    const again = issueAuthToken(state, { userId: "user-educator-1", purpose: "INVITE", createdById: "user-admin-1" });
    for (const provision of state.access) {
      if (provision.userId === "user-educator-1") provision.active = false;
    }
    expect(resolveAuthToken(state, again.rawToken)).toBeNull();
  });
});

describe("email/password authentication", () => {
  it("authenticates a provisioned fixture user and fails closed on every other path", async () => {
    const state = createSanitizedPilotState();
    const user = await authenticateEmailPassword(state, "Alex.Educator@example.test", SANITIZED_FIXTURE_PASSWORD);
    expect(user?.id).toBe("user-educator-1");

    expect(await authenticateEmailPassword(state, "alex.educator@example.test", "a-wrong-pilot-password")).toBeNull();
    expect(await authenticateEmailPassword(state, "unknown@example.test", SANITIZED_FIXTURE_PASSWORD)).toBeNull();

    for (const provision of state.access) {
      if (provision.userId === "user-educator-1") provision.active = false;
    }
    expect(await authenticateEmailPassword(state, "alex.educator@example.test", SANITIZED_FIXTURE_PASSWORD)).toBeNull();
  });
});

describe("expanded Admin staff management", () => {
  it("edits display name and role while protecting the actor and assigned educators", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminAccessService(repository);

    const blocked = await service.mutate(adminRequest(), {
      action: "EDIT_STAFF", userId: "user-educator-1", role: "ADMIN"
    });
    expect(blocked).toMatchObject({ blocked: true });

    const renamed = await service.mutate(adminRequest(), {
      action: "EDIT_STAFF", userId: "user-educator-2", displayName: "Jordan Lee-Rivera", role: "ADMIN"
    });
    expect(renamed).toMatchObject({ educator: { displayName: "Jordan Lee-Rivera", role: "ADMIN" } });
    expect(repository.current().access.find((provision) => provision.userId === "user-educator-2")?.role).toBe("ADMIN");

    await expect(service.mutate(adminRequest(), {
      action: "EDIT_STAFF", userId: "user-admin-1", role: "EDUCATOR"
    })).rejects.toThrow("cannot change their own role");
  });

  it("removes staff, revokes everything, retains attribution, and frees the email", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminAccessService(repository);

    await expect(service.mutate(adminRequest(), {
      action: "REMOVE_STAFF", userId: "user-admin-1"
    })).rejects.toThrow("cannot remove their own access");

    const removed = await service.mutate(adminRequest(), { action: "REMOVE_STAFF", userId: "user-educator-1" });
    expect(removed).toMatchObject({ removed: true });

    const state = repository.current();
    const formerEducator = state.users.find((user) => user.id === "user-educator-1");
    expect(formerEducator?.isActive).toBe(false);
    expect(formerEducator?.email).toMatch(/@removed\.invalid$/);
    expect(formerEducator?.displayName).toBe("Alex Morgan");
    expect(state.assignments.filter((assignment) => assignment.educatorId === "user-educator-1" && assignment.active)).toHaveLength(0);
    expect((state.credentials ?? []).some((credential) => credential.userId === "user-educator-1")).toBe(false);

    const reprovisioned = await service.mutate(adminRequest(), {
      action: "PROVISION_STAFF", email: "alex.educator@example.test", displayName: "Alex Morgan", role: "EDUCATOR"
    });
    expect(reprovisioned).toMatchObject({ educator: { email: "alex.educator@example.test" } });
    expect((reprovisioned as { educator: { id: string } }).educator.id).not.toBe("user-educator-1");
  });

  it("issues invites through provisioning and resend only in email/password mode", async () => {
    const repository = inMemoryRepository(createSanitizedPilotState());
    const service = createAdminAccessService(repository);

    const sandboxResend = await service.mutate(adminRequest(), { action: "RESEND_INVITE", userId: "user-educator-1" });
    expect(sandboxResend).toMatchObject({ blocked: true });

    vi.stubEnv("HELP_REVIEW_IDENTITY_ADAPTER", "email-password");
    const provisioned = await service.mutate(adminRequest(emailPasswordIdentity), {
      action: "PROVISION_STAFF", email: "new.educator@example.test", displayName: "New Educator", role: "EDUCATOR"
    }) as { educator: { id: string }; invite?: { rawToken: string } };
    expect(provisioned.invite?.rawToken).toBeTruthy();

    const summary = credentialSummary(repository.current(), provisioned.educator.id);
    expect(summary).toEqual({ hasPassword: false, invitePending: true });

    const resent = await service.mutate(adminRequest(emailPasswordIdentity), {
      action: "RESEND_INVITE", userId: provisioned.educator.id
    }) as { invite?: { rawToken: string } };
    expect(resent.invite?.rawToken).toBeTruthy();
    expect(resent.invite?.rawToken).not.toBe(provisioned.invite?.rawToken);

    const state = repository.current();
    expect(resolveAuthToken(state, provisioned.invite!.rawToken)).toBeNull();
    expect(resolveAuthToken(state, resent.invite!.rawToken)?.user.id).toBe(provisioned.educator.id);
  });
});
