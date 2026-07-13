import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { assertSameOrigin } from "./server-http";

describe("same-origin mutation guard", () => {
  it("uses the browser-visible host instead of an internal rewritten URL host", () => {
    const request = new NextRequest("http://localhost:3000/api/session", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000"
      }
    });

    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a mutation from another origin", () => {
    const request = new NextRequest("http://localhost:3000/api/session", {
      headers: {
        host: "pilot.example.test",
        origin: "https://attacker.example.test"
      }
    });

    expect(() => assertSameOrigin(request)).toThrow("not allowed");
  });
});
