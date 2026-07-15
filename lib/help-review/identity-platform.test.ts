import { describe, expect, it, vi } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import type { PilotState } from "./models";
import type { updatePilotState } from "./server-store";
import {
  authenticateIdentityPlatformUser,
  ensureIdentityPlatformAccount,
  linkIdentityPlatformUser,
  setIdentityPlatformAccountEnabled,
  type IdentityPlatformAdminClient,
  type IdentityPlatformVerifier
} from "./identity-platform";

describe("Identity Platform provisioning boundary", () => {
  it("links a verified UID to the exact active pre-provisioned email", () => {
    const state = createSanitizedPilotState();
    const user = linkIdentityPlatformUser(state, {
      subject: "identity-platform:verified-alex",
      email: "ALEX.EDUCATOR@EXAMPLE.TEST"
    });

    expect(user).toMatchObject({
      id: "user-educator-1",
      externalSubject: "identity-platform:verified-alex",
      role: "EDUCATOR"
    });
    expect(state.users.find((candidate) => candidate.id === user?.id)?.externalSubject)
      .toBe("identity-platform:verified-alex");
  });

  it("rejects an unprovisioned email without creating a user", () => {
    const state = createSanitizedPilotState();
    const originalUsers = state.users.length;
    expect(linkIdentityPlatformUser(state, {
      subject: "identity-platform:unknown",
      email: "unknown@example.test"
    })).toBeNull();
    expect(state.users).toHaveLength(originalUsers);
  });

  it("rejects inactive access, role drift, and changed provider email", () => {
    const inactive = createSanitizedPilotState();
    inactive.access.find((candidate) => candidate.userId === "user-educator-1")!.active = false;
    expect(linkIdentityPlatformUser(inactive, {
      subject: "identity-platform:inactive",
      email: "alex.educator@example.test"
    })).toBeNull();

    const roleDrift = createSanitizedPilotState();
    roleDrift.access = roleDrift.access.map((candidate) => candidate.userId === "user-educator-1"
      ? { ...candidate, role: "ADMIN" }
      : candidate);
    expect(linkIdentityPlatformUser(roleDrift, {
      subject: "identity-platform:role-drift",
      email: "alex.educator@example.test"
    })).toBeNull();

    const changedEmail = createSanitizedPilotState();
    changedEmail.users[0] = {
      ...changedEmail.users[0],
      externalSubject: "identity-platform:existing"
    };
    expect(linkIdentityPlatformUser(changedEmail, {
      subject: "identity-platform:existing",
      email: "changed@example.test"
    })).toBeNull();
  });

  it("persists the link only after the verifier succeeds", async () => {
    const state = createSanitizedPilotState();
    const verifier: IdentityPlatformVerifier = {
      verify: vi.fn().mockResolvedValue({
        subject: "identity-platform:verified-jordan",
        email: "jordan.educator@example.test"
      })
    };
    const updateState = vi.fn(async (mutation: (current: PilotState) => unknown) => mutation(state));

    await expect(authenticateIdentityPlatformUser("verified-token", {
      verifier,
      updateState: updateState as unknown as typeof updatePilotState
    }))
      .resolves.toMatchObject({ id: "user-educator-2" });
    expect(verifier.verify).toHaveBeenCalledWith("verified-token");
    expect(updateState).toHaveBeenCalledOnce();
  });

  it("creates a provider account once and leaves credential setup to provider email flows", async () => {
    const missing = Object.assign(new Error("missing"), { code: "auth/user-not-found" });
    const client = {
      getUser: vi.fn(),
      getUserByEmail: vi.fn().mockRejectedValue(missing),
      createUser: vi.fn().mockResolvedValue({ uid: "provider-1", disabled: false }),
      updateUser: vi.fn()
    } as unknown as IdentityPlatformAdminClient;

    await expect(ensureIdentityPlatformAccount(" Staff@Example.Test ", "Staff Member", client))
      .resolves.toEqual({ uid: "provider-1", created: true });
    expect(client.createUser).toHaveBeenCalledWith({
      email: "staff@example.test",
      displayName: "Staff Member",
      disabled: false,
      emailVerified: false
    });

    client.getUserByEmail = vi.fn().mockResolvedValue({ uid: "provider-1", disabled: false });
    await expect(ensureIdentityPlatformAccount("staff@example.test", "Staff Member", client))
      .resolves.toEqual({ uid: "provider-1", created: false });
    expect(client.createUser).toHaveBeenCalledOnce();
  });

  it("mirrors access deactivation to the provider UID", async () => {
    const client = {
      getUser: vi.fn().mockResolvedValue({ uid: "provider-1", disabled: false }),
      getUserByEmail: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn().mockResolvedValue(undefined)
    } as unknown as IdentityPlatformAdminClient;

    await setIdentityPlatformAccountEnabled({
      externalSubject: "identity-platform:provider-1",
      email: "staff@example.test"
    }, false, client);
    expect(client.getUser).toHaveBeenCalledWith("provider-1");
    expect(client.updateUser).toHaveBeenCalledWith("provider-1", { disabled: true });
  });
});
