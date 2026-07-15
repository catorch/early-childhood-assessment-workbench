import { describe, expect, it, vi } from "vitest";

import { selectScoringCandidates } from "./help-catalog";
import {
  HELP_CATALOG_VERSION,
  SCORING_CONTRACT_VERSION,
  ScoringRequestSchema,
  ScoringResultSchema,
  validateScoringResultForRequest
} from "./scoring-contract";
import { FakeScoringGateway, GeminiScoringGateway } from "./scoring-gateway";

function request() {
  return ScoringRequestSchema.parse({
    contractVersion: SCORING_CONTRACT_VERSION,
    runId: "run-contract-1",
    idempotencyKey: "job-contract-1",
    catalogVersion: HELP_CATALOG_VERSION,
    observation: {
      observationDate: "2026-07-14",
      ageMonthsAtObservation: 19,
      supportContext: "NONE_REPORTED"
    },
    video: {
      videoAssetId: "video-contract-1",
      contentType: "video/mp4",
      byteSize: 3,
      durationSeconds: 180,
      checksumSha256: "a".repeat(64)
    },
    candidates: [{
      sourceSkillId: "help-4.68",
      skillCode: "4.68",
      skillName: "Builds tower using two cubes",
      domain: "Fine Motor",
      strand: "Block construction",
      minimumAgeMonths: 12,
      maximumAgeMonths: 30,
      sourceOrder: 0
    }]
  });
}

describe("scoring contract v0", () => {
  it("selects an ordered age-first candidate set with bounded downward coverage", () => {
    const candidates = selectScoringCandidates(19, "IFSP");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.map((candidate) => candidate.sourceOrder)).toEqual(
      [...candidates].map((candidate) => candidate.sourceOrder).sort((left, right) => left - right)
    );
    expect(candidates.every((candidate) => candidate.minimumAgeMonths <= 19)).toBe(true);
  });

  it("rejects partial suggestions for a no-valid-results outcome", () => {
    const parsed = ScoringResultSchema.safeParse({
      contractVersion: SCORING_CONTRACT_VERSION,
      runId: "run-contract-1",
      outcome: "NO_VALID_RESULTS",
      scoringConfigurationReference: "fixture:test",
      suggestions: [{
        id: "suggestion-1",
        sourceSkillId: "help-4.68",
        skillCode: "4.68",
        skillName: "Builds tower using two cubes",
        domain: "Fine Motor",
        strand: "Block construction",
        draftCredit: "PRESENT",
        confidence: 0.9,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 4, explanation: "Two cubes remain stacked." }],
        sourceOrder: 0
      }]
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects mismatched runs, candidate metadata, and out-of-video evidence", () => {
    const base = {
      contractVersion: SCORING_CONTRACT_VERSION,
      runId: "run-contract-1",
      outcome: "VALID" as const,
      scoringConfigurationReference: "fixture:test",
      suggestions: [{
        id: "suggestion-1",
        sourceSkillId: "help-4.68",
        skillCode: "4.68",
        skillName: "Builds tower using two cubes",
        domain: "Fine Motor",
        strand: "Block construction",
        draftCredit: "PRESENT" as const,
        confidence: 0.9,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 4, explanation: "Two cubes remain stacked." }],
        sourceOrder: 0
      }]
    };
    expect(() => validateScoringResultForRequest(request(), { ...base, runId: "other-run" })).toThrow("request identity");
    expect(() => validateScoringResultForRequest(request(), {
      ...base,
      suggestions: [{ ...base.suggestions[0]!, skillCode: "wrong" }]
    })).toThrow("candidate contract");
    expect(() => validateScoringResultForRequest(request(), {
      ...base,
      suggestions: [{ ...base.suggestions[0]!, evidence: [{ timestampSeconds: 181, explanation: "Outside." }] }]
    })).toThrow("observation duration");
  });

  it.each([
    ["no-valid-results", "NO_VALID_RESULTS"],
    ["uncertain", "VALID"],
    ["slow", "VALID"]
  ] as const)("runs the %s deterministic fake contract case", async (scenario, outcome) => {
    const result = await new FakeScoringGateway(scenario).score(request(), {
      kind: "bytes",
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "video/mp4"
    });
    expect(result.outcome).toBe(outcome);
  });

  it.each([
    ["invalid-credit", "INVALID_RESULT", false],
    ["invalid-evidence", "INVALID_RESULT", false],
    ["empty-result", "INVALID_RESULT", false],
    ["retryable-failure", "SCORING_UNAVAILABLE", true],
    ["terminal-failure", "SCORING_AUTHENTICATION_FAILED", false]
  ] as const)("maps the %s fake contract case safely", async (scenario, safeCode, retryable) => {
    await expect(new FakeScoringGateway(scenario).score(request(), {
      kind: "bytes",
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "video/mp4"
    })).rejects.toMatchObject({ safeCode, retryable });
  });

  it("maps a Gemini structured result only through the candidate allowlist", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "x-goog-upload-url": "https://upload.example.test/video" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ file: { name: "files/fixture", uri: "https://files.example.test/fixture", mimeType: "video/mp4", state: "ACTIVE" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ outcome: "VALID", suggestions: [{ sourceSkillId: "help-4.68", draftCredit: null, confidence: null, uncertaintyReason: "The release is obscured.", evidence: [{ timestampSeconds: 8, explanation: "The child positions one cube over another." }] }] }) }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const gateway = new GeminiScoringGateway({
      apiKey: "test-key",
      model: "gemini-test",
      fetchImplementation
    });

    const result = await gateway.score(request(), { kind: "bytes", bytes: new Uint8Array([1, 2, 3]), contentType: "video/mp4" });

    expect(result.outcome).toBe("VALID");
    expect(result.suggestions[0]).toMatchObject({
      sourceSkillId: "help-4.68",
      draftCredit: null,
      uncertaintyReason: "The release is obscured."
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });

  it("rejects a Gemini skill outside the supplied candidate list", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "x-goog-upload-url": "https://upload.example.test/video" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ file: { name: "files/fixture", uri: "https://files.example.test/fixture", state: "ACTIVE" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ outcome: "VALID", suggestions: [{ sourceSkillId: "unknown-skill", draftCredit: "PRESENT", confidence: 0.99, uncertaintyReason: null, evidence: [{ timestampSeconds: 1, explanation: "Unsupported." }] }] }) }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const gateway = new GeminiScoringGateway({ apiKey: "test-key", model: "gemini-test", fetchImplementation });

    await expect(gateway.score(request(), { kind: "bytes", bytes: new Uint8Array([1, 2, 3]), contentType: "video/mp4" }))
      .rejects.toMatchObject({ safeCode: "INVALID_RESULT", retryable: false });
  });
});
