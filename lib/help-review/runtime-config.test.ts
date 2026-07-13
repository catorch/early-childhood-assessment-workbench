import { describe, expect, it } from "vitest";

import { assertRuntimeConfiguration } from "./runtime-config";

describe("runtime adapter guard", () => {
  it("allows sanitized adapters during local development", () => {
    expect(() => assertRuntimeConfiguration({ NODE_ENV: "development" })).not.toThrow();
  });

  it("fails closed for an unacknowledged production runtime", () => {
    expect(() => assertRuntimeConfiguration({ NODE_ENV: "production" })).toThrow("not approved for production");
  });

  it("allows only an explicitly acknowledged sanitized production demonstration", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        HELP_REVIEW_SANITIZED_PRODUCTION_ACK: "true"
      })
    ).not.toThrow();
  });
});
