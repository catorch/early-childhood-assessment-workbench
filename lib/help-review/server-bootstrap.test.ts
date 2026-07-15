import { describe, expect, it } from "vitest";

import { createApplicationDependencies } from "./server-bootstrap";

describe("application dependency bootstrap", () => {
  it("builds injectable local adapters outside production", () => {
    const dependencies = createApplicationDependencies({
      NODE_ENV: "test",
      HELP_REVIEW_STATE_ADAPTER: "local",
      HELP_REVIEW_VIDEO_ADAPTER: "local",
      HELP_REVIEW_SCORING_ADAPTER: "fake"
    });
    expect(dependencies.identity.name).toBe("sandbox");
    expect(dependencies.videoStorage.name).toBe("local");
    expect(dependencies.scoringGateway.name).toBe("fake");
    expect(dependencies.assessments.create).toBeTypeOf("function");
    expect(dependencies.children.listAssigned).toBeTypeOf("function");
    expect(dependencies.review.saveDecision).toBeTypeOf("function");
    expect(dependencies.videoAssets.authorizeUpload).toBeTypeOf("function");
    expect(dependencies.adminAccess.mutate).toBeTypeOf("function");
    expect(dependencies.adminJobs.retry).toBeTypeOf("function");
  });

  it("fails before constructing production local adapters", () => {
    expect(() => createApplicationDependencies({
      NODE_ENV: "production",
      HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true",
      HELP_REVIEW_STATE_ADAPTER: "local",
      HELP_REVIEW_VIDEO_ADAPTER: "local"
    })).toThrow("Neon state adapter");
  });
});
