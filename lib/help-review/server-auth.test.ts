import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import {
  AccessError,
  activeUserFromState,
  hasActiveAssignment,
  identityPlatformIdentity,
  sandboxIdentity,
  SESSION_COOKIE
} from "./server-auth";

function requestFor(userId?: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: userId ? { cookie: `${SESSION_COOKIE}=${sandboxIdentity.issue(userId)}` } : undefined
  });
}

describe("assignment-aware sandbox authorization", () => {
  it("requires an active provision in addition to an Educator identity", () => {
    const state = createSanitizedPilotState();
    state.access[0]!.active = false;

    expect(() => activeUserFromState(requestFor("user-educator-1"), state)).toThrow(AccessError);
  });

  it("requires an active provision for an Admin identity too", () => {
    const state = createSanitizedPilotState();
    const adminProvision = state.access.find((provision) => provision.userId === "user-admin-1");
    expect(adminProvision).toBeDefined();
    adminProvision!.active = false;

    expect(() => activeUserFromState(requestFor("user-admin-1"), state)).toThrow(AccessError);
  });

  it("does not infer child access from the Educator role", () => {
    const state = createSanitizedPilotState();

    expect(hasActiveAssignment(state, "user-educator-1", "child-1001")).toBe(true);
    expect(hasActiveAssignment(state, "user-educator-2", "child-1001")).toBe(false);
  });

  it("rejects a missing session", () => {
    expect(() => activeUserFromState(requestFor(), createSanitizedPilotState())).toThrow("valid session");
  });

  it("rejects a forged or expired session", () => {
    const state = createSanitizedPilotState();
    const valid = sandboxIdentity.issue("user-educator-1", new Date("2026-07-14T12:00:00.000Z"));
    const forged = `${valid.slice(0, -1)}x`;
    const forgedRequest = new NextRequest("http://localhost/api/test", {
      headers: { cookie: `${SESSION_COOKIE}=${forged}` }
    });
    expect(() => activeUserFromState(forgedRequest, state)).toThrow(AccessError);
    expect(sandboxIdentity.resolve(valid, new Date("2026-07-15T12:00:00.000Z"))).toBeNull();
  });

  it("does not accept a sandbox application session at the managed identity boundary", () => {
    const state = createSanitizedPilotState();
    expect(() => activeUserFromState(
      requestFor("user-educator-1"),
      state,
      identityPlatformIdentity
    )).toThrow(AccessError);

    const managed = identityPlatformIdentity.issue("user-educator-1", new Date("2026-07-15T12:00:00.000Z"));
    expect(identityPlatformIdentity.resolve(managed, new Date("2026-07-15T12:59:59.000Z"))?.subject)
      .toBe("user-educator-1");
    expect(identityPlatformIdentity.resolve(managed, new Date("2026-07-15T13:00:00.000Z")))
      .toBeNull();
  });
});
