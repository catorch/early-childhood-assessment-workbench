import { describe, expect, it } from "vitest";

import { assertRuntimeConfiguration } from "./runtime-config";

describe("runtime adapter guard", () => {
  it("allows sanitized adapters during local development", () => {
    expect(() => assertRuntimeConfiguration({ NODE_ENV: "development" })).not.toThrow();
  });

  it("fails closed for an unacknowledged production runtime", () => {
    expect(() => assertRuntimeConfiguration({ NODE_ENV: "production" })).toThrow("not approved for production");
  });

  it("allows only an acknowledged production demonstration with durable adapters", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true",
        HELP_REVIEW_STATE_ADAPTER: "neon",
        HELP_REVIEW_VIDEO_ADAPTER: "vercel-blob",
        DATABASE_URL: "postgresql://example.invalid/demo",
        BLOB_READ_WRITE_TOKEN: "test-token",
        HELP_REVIEW_SESSION_SECRET: "a-production-session-secret-with-32-characters",
        HELP_REVIEW_PLAYBACK_GRANT_SECRET: "a-production-playback-secret-with-32-characters",
        CRON_SECRET: "a-production-cron-secret-with-32-characters"
      })
    ).not.toThrow();
  });

  it("requires a strong scheduled recovery secret in production", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true",
        HELP_REVIEW_STATE_ADAPTER: "neon",
        HELP_REVIEW_VIDEO_ADAPTER: "vercel-blob",
        DATABASE_URL: "postgresql://example.invalid/demo",
        BLOB_READ_WRITE_TOKEN: "test-token",
        HELP_REVIEW_SESSION_SECRET: "a-production-session-secret-with-32-characters",
        HELP_REVIEW_PLAYBACK_GRANT_SECRET: "a-production-playback-secret-with-32-characters"
      })
    ).toThrow("HELP_REVIEW_WORKER_SECRET or CRON_SECRET");
  });

  it("rejects acknowledged production with ephemeral adapters", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true"
      })
    ).toThrow("Neon state adapter");
  });

  it("rejects real data with sandbox identity or fake scoring", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_REAL_DATA_ENABLED: "true",
        HELP_REVIEW_REAL_DATA_APPROVAL_ID: "approval-1",
        HELP_REVIEW_IDENTITY_ADAPTER: "sandbox",
        HELP_REVIEW_SCORING_ADAPTER: "fake",
        HELP_REVIEW_WORKER_SECRET: "worker-secret",
        HELP_REVIEW_STATE_ADAPTER: "neon",
        HELP_REVIEW_VIDEO_ADAPTER: "vercel-blob",
        DATABASE_URL: "postgresql://example.invalid/demo",
        BLOB_READ_WRITE_TOKEN: "test-token"
      })
    ).toThrow("sandbox identity adapter");
  });

  it("requires an explicit approval record before real data", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_REAL_DATA_ENABLED: "true"
      })
    ).toThrow("Real-data configuration is incomplete");
  });
});
