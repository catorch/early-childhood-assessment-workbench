import { describe, expect, it, vi } from "vitest";

import { incrementSharedRateLimit, type SharedRateLimitStore } from "./shared-rate-limit";

describe("shared rate-limit window", () => {
  it("passes only hashed identity, scope, and fixed window timestamps to storage", async () => {
    const increment = vi.fn().mockResolvedValue(2);
    const store: SharedRateLimitStore = { increment };

    await expect(incrementSharedRateLimit("assessment-process", "a".repeat(64), 1_000, 60_000, store))
      .resolves.toBe(2);
    expect(increment).toHaveBeenCalledWith({
      scope: "assessment-process",
      identityHash: "a".repeat(64),
      now: new Date(1_000),
      resetAt: new Date(61_000)
    });
  });
});
