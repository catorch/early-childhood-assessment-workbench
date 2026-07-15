import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import {
  assertSameOrigin,
  enforceRateLimit,
  publicRequestOrigin,
  readJsonBody,
  RequestError,
  routeError
} from "./server-http";

describe("same-origin mutation guard", () => {
  it("uses the browser-visible host instead of an internal rewritten URL host", () => {
    const request = new NextRequest("http://localhost:3000/api/session", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000"
      }
    });

    expect(() => assertSameOrigin(request)).not.toThrow();
    expect(publicRequestOrigin(request)).toBe("http://127.0.0.1:3000");
  });

  it("reconstructs the public origin from trusted proxy headers when Origin is absent", () => {
    const request = new NextRequest("https://0.0.0.0:8080/api/session", {
      headers: {
        "x-forwarded-host": "pilot.example.test",
        "x-forwarded-proto": "https"
      }
    });

    expect(publicRequestOrigin(request)).toBe("https://pilot.example.test");
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

  it("rejects browser mutations declared cross-site even without an Origin header", () => {
    const request = new NextRequest("https://pilot.example.test/api/session", {
      headers: { "sec-fetch-site": "cross-site" }
    });

    expect(() => assertSameOrigin(request)).toThrow("not allowed");
  });

  it("rejects malformed Origin values", () => {
    const request = new NextRequest("https://pilot.example.test/api/session", {
      headers: { host: "pilot.example.test", origin: "://not-an-origin" }
    });

    expect(() => assertSameOrigin(request)).toThrow("invalid");
  });
});

describe("bounded JSON request parsing", () => {
  function jsonRequest(body: string, headers: Record<string, string> = {}) {
    return new NextRequest("https://pilot.example.test/api/command", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body
    });
  }

  it("accepts a JSON object within the byte limit", async () => {
    await expect(readJsonBody(jsonRequest('{"ok":true}'), 64)).resolves.toEqual({ ok: true });
  });

  it("rejects a non-JSON content type", async () => {
    const request = new NextRequest("https://pilot.example.test/api/command", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello"
    });

    await expect(readJsonBody(request, 64)).rejects.toMatchObject({ status: 400 });
  });

  it("enforces both declared and actual UTF-8 body size", async () => {
    await expect(readJsonBody(jsonRequest("{}", { "content-length": "65" }), 64))
      .rejects.toMatchObject({ status: 413 });
    await expect(readJsonBody(jsonRequest(JSON.stringify({ value: "x".repeat(80) })), 64))
      .rejects.toMatchObject({ status: 413 });
  });

  it("returns a bounded validation error for malformed JSON", async () => {
    await expect(readJsonBody(jsonRequest("{"), 64)).rejects.toMatchObject({ status: 400 });
  });
});

describe("safe HTTP failure handling", () => {
  it("does not log or return the original failure message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = routeError(new Error("DATABASE_URL=protected-value"));
    const payload = await response.json() as { error: string; reference: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("The request could not be completed.");
    expect(payload.reference).toBe(response.headers.get("x-correlation-id"));
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("protected-value");
    consoleError.mockRestore();
  });

  it("keeps intentional request errors client-safe", async () => {
    const response = routeError(new RequestError("The request body is too large.", 413));
    await expect(response.json()).resolves.toEqual({ error: "The request body is too large." });
    expect(response.status).toBe(413);
  });

  it("rate limits a hashed request identity without exposing it", () => {
    const request = new NextRequest("https://pilot.example.test/api/command", {
      headers: { "x-forwarded-for": "203.0.113.22" }
    });
    const scope = `test-${crypto.randomUUID()}`;
    expect(() => enforceRateLimit(request, scope, { limit: 1 }, 1_000)).not.toThrow();
    expect(() => enforceRateLimit(request, scope, { limit: 1 }, 1_001)).toThrow(RequestError);
  });
});
