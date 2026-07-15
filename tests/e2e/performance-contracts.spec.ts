import { expect, test, type APIResponse } from "@playwright/test";

import { resetScreenFixture, signIn } from "./helpers";

interface Measurement {
  readonly name: string;
  readonly status: number;
  readonly durationMs: number;
  readonly payloadBytes: number;
}

async function measure(name: string, operation: () => Promise<APIResponse>): Promise<Measurement> {
  const startedAt = performance.now();
  const response = await operation();
  const body = await response.body();
  return {
    name,
    status: response.status(),
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    payloadBytes: body.byteLength
  };
}

test("representative API latency and payloads stay within sanitized release budgets", async ({ page }, testInfo) => {
  await resetScreenFixture(page, "05");
  await signIn(page);

  const measurements = [
    await measure("readiness", () => page.request.get("/api/health")),
    await measure("assigned-children", () => page.request.get("/api/children")),
    await measure("assessment-index", () => page.request.get("/api/assessments?filter=all")),
    await measure("review-projection", () => page.request.get("/api/assessments/assessment-ready/review")),
    await measure("processing-status", () => page.request.get("/api/assessments/assessment-processing/status"))
  ];

  await testInfo.attach("performance-measurements", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json"
  });
  for (const measurement of measurements) {
    expect(measurement.status, measurement.name).toBe(200);
    expect(measurement.durationMs, measurement.name).toBeLessThan(3_000);
    expect(measurement.payloadBytes, measurement.name).toBeLessThanOrEqual(
      measurement.name === "review-projection" ? 256 * 1024 : 128 * 1024
    );
  }
});
