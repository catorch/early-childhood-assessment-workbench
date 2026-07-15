import { once } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProcessorServer } from "./server";

describe("standalone processor HTTP boundary", () => {
  beforeEach(() => {
    vi.stubEnv("GCS_VIDEO_BUCKET", "test-video-bucket");
    vi.stubEnv("HELP_REVIEW_WORKER_SECRET", "processor-test-secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("serves health, ignores unrelated events, and protects internal dispatch", async () => {
    const server = createProcessorServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP processor address.");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const health = await fetch(`${baseUrl}/healthz`);
      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toEqual({ ok: true, service: "help-review-processor" });

      const ignored = await fetch(`${baseUrl}/events/storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ce-id": "event-1" },
        body: JSON.stringify({ bucket: "test-video-bucket", name: "videos/source.mp4" })
      });
      expect(ignored.status).toBe(204);

      const unauthorized = await fetch(
        `${baseUrl}/internal/process/run-00000000-0000-4000-8000-000000000001`,
        { method: "POST" }
      );
      expect(unauthorized.status).toBe(401);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
