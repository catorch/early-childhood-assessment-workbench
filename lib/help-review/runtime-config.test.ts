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
        BLOB_READ_WRITE_TOKEN: "test-token"
      })
    ).not.toThrow();
  });

  it("rejects acknowledged production with ephemeral adapters", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true"
      })
    ).toThrow("Neon state adapter");
  });
});
