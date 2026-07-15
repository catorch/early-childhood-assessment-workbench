import { describe, expect, it } from "vitest";

import { createSanitizedPilotState } from "./fixtures";
import { recordSupportEvent } from "./server-events";

describe("support events", () => {
  it("persists only the approved diagnostic field allowlist", () => {
    const state = createSanitizedPilotState();
    const event = recordSupportEvent(state, {
      type: "PROCESSING_RETRIED",
      actorId: "user-admin-1",
      assessmentId: "assessment-failed",
      referenceId: "run-failed-1",
      occurredAt: "2026-07-15T12:00:00.000Z",
      rawProviderError: "must not survive",
      uploadedFilename: "must-not-survive.mp4"
    } as Parameters<typeof recordSupportEvent>[1]);

    expect(event.id).toMatch(/^event-[0-9a-f-]{36}$/);
    expect(event).toEqual({
      id: event.id,
      type: "PROCESSING_RETRIED",
      actorId: "user-admin-1",
      occurredAt: "2026-07-15T12:00:00.000Z",
      assessmentId: "assessment-failed",
      referenceId: "run-failed-1"
    });
    expect(state.supportEvents).toEqual([event]);
  });
});
