import { afterEach, describe, expect, it, vi } from "vitest";

import {
  runIdFromProcessingMarker,
  selectedProcessingDispatchAdapter
} from "./processing-dispatcher";

describe("processing dispatch contract", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("selects only supported dispatch adapters", () => {
    expect(selectedProcessingDispatchAdapter({})).toBe("inline");
    expect(selectedProcessingDispatchAdapter({ HELP_REVIEW_PROCESSING_ADAPTER: "http" })).toBe("http");
    expect(selectedProcessingDispatchAdapter({ HELP_REVIEW_PROCESSING_ADAPTER: "gcs-event" })).toBe("gcs-event");
    expect(() => selectedProcessingDispatchAdapter({ HELP_REVIEW_PROCESSING_ADAPTER: "unknown" })).toThrow("Unsupported");
  });

  it("accepts only run markers under the configured request prefix", () => {
    const runId = "run-00000000-0000-4000-8000-000000000001";
    expect(runIdFromProcessingMarker(`processing-requests/${runId}.json`)).toBe(runId);
    expect(runIdFromProcessingMarker(`videos/${runId}.json`)).toBeNull();
    expect(runIdFromProcessingMarker("processing-requests/not-a-run.json")).toBeNull();

    vi.stubEnv("GCS_PROCESSING_REQUEST_PREFIX", "/commands");
    expect(runIdFromProcessingMarker(`commands/${runId}.json`)).toBe(runId);
  });
});
