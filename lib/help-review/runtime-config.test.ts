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
        NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL: "pilot-support@help-review.dev",
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
        NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL: "pilot-support@help-review.dev",
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

  it("rejects a missing or reserved production support address", () => {
    const base = {
      NODE_ENV: "production" as const,
      HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true",
      HELP_REVIEW_STATE_ADAPTER: "neon",
      HELP_REVIEW_VIDEO_ADAPTER: "vercel-blob",
      DATABASE_URL: "postgresql://example.invalid/demo",
      BLOB_READ_WRITE_TOKEN: "test-token",
      HELP_REVIEW_SESSION_SECRET: "a-production-session-secret-with-32-characters",
      HELP_REVIEW_PLAYBACK_GRANT_SECRET: "a-production-playback-secret-with-32-characters",
      CRON_SECRET: "a-production-cron-secret-with-32-characters"
    };
    expect(() => assertRuntimeConfiguration(base)).toThrow("NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL");
    expect(() => assertRuntimeConfiguration({
      ...base,
      NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL: "pilot-support@example.test"
    })).toThrow("NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL");
  });

  it("rejects real data with sandbox identity or fake scoring", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_REAL_DATA_ENABLED: "true",
        HELP_REVIEW_REAL_DATA_APPROVAL_ID: "approval-1",
        HELP_REVIEW_IDENTITY_ADAPTER: "sandbox",
        HELP_REVIEW_SCORING_ADAPTER: "fake",
        HELP_REVIEW_HELP_CATALOG_PATH: "tests/fixtures/help-catalog.authoritative-contract-test.json",
        HELP_REVIEW_HELP_CATALOG_VERSION: "help-contract-test-1",
        HELP_REVIEW_HELP_CATALOG_SHA256: "db976cffe239c99118eb40bed451b6fbb42e9a21da9c1fea8d1de66994cb2623",
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

  it("allows the selected managed identity path with complete real-data infrastructure", () => {
    expect(() => assertRuntimeConfiguration({
      NODE_ENV: "production",
      HELP_REVIEW_REAL_DATA_ENABLED: "true",
      HELP_REVIEW_REAL_DATA_APPROVAL_ID: "approval-identity-platform-1",
      HELP_REVIEW_IDENTITY_ADAPTER: "identity-platform",
      HELP_REVIEW_IDENTITY_PLATFORM_PROJECT_ID: "help-review-production",
      HELP_REVIEW_IDENTITY_PLATFORM_API_KEY: "restricted-browser-api-key",
      HELP_REVIEW_SCORING_ADAPTER: "vertex",
      HELP_REVIEW_HELP_CATALOG_PATH: "tests/fixtures/help-catalog.authoritative-contract-test.json",
      HELP_REVIEW_HELP_CATALOG_VERSION: "help-contract-test-1",
      HELP_REVIEW_HELP_CATALOG_SHA256: "db976cffe239c99118eb40bed451b6fbb42e9a21da9c1fea8d1de66994cb2623",
      HELP_REVIEW_STATE_ADAPTER: "neon",
      HELP_REVIEW_VIDEO_ADAPTER: "gcs",
      HELP_REVIEW_PROCESSING_ADAPTER: "gcs-event",
      DATABASE_URL: "postgresql://example.invalid/production",
      GOOGLE_CLOUD_PROJECT: "help-review-production",
      GCS_VIDEO_BUCKET: "help-review-production-videos",
      NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL: "pilot-support@help-review.dev",
      HELP_REVIEW_SESSION_SECRET: "a-production-session-secret-with-32-characters",
      HELP_REVIEW_PLAYBACK_GRANT_SECRET: "a-production-playback-secret-with-32-characters",
      HELP_REVIEW_UPLOAD_GRANT_SECRET: "a-production-upload-secret-with-32-characters",
      HELP_REVIEW_WORKER_SECRET: "a-production-worker-secret-with-32-characters"
    })).not.toThrow();
  });

  it("rejects a managed identity web service without its browser API key", () => {
    expect(() => assertRuntimeConfiguration({
      NODE_ENV: "production",
      HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true",
      HELP_REVIEW_IDENTITY_ADAPTER: "identity-platform",
      HELP_REVIEW_IDENTITY_PLATFORM_PROJECT_ID: "help-review-staging",
      HELP_REVIEW_STATE_ADAPTER: "neon",
      HELP_REVIEW_VIDEO_ADAPTER: "vercel-blob",
      DATABASE_URL: "postgresql://example.invalid/staging",
      BLOB_READ_WRITE_TOKEN: "test-token",
      NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL: "pilot-support@help-review.dev",
      HELP_REVIEW_SESSION_SECRET: "a-production-session-secret-with-32-characters",
      HELP_REVIEW_PLAYBACK_GRANT_SECRET: "a-production-playback-secret-with-32-characters",
      HELP_REVIEW_WORKER_SECRET: "a-production-worker-secret-with-32-characters"
    })).toThrow("HELP_REVIEW_IDENTITY_PLATFORM_API_KEY");
  });
});
