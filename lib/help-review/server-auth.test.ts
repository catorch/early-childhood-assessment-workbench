import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import { AccessError, activeUserFromState, hasActiveAssignment, SESSION_COOKIE } from "./server-auth";

function requestFor(userId?: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: userId ? { cookie: `${SESSION_COOKIE}=${userId}` } : undefined
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
    expect(() => activeUserFromState(requestFor(), createSanitizedPilotState())).toThrow("valid sandbox session");
  });
});
