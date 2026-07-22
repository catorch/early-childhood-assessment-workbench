import { describe, expect, it, vi } from "vitest";

import { selectScoringCandidates } from "./help-catalog";
import {
  HELP_CATALOG_VERSION,
  SCORING_CONTRACT_VERSION,
  ScoringRequestSchema,
  ScoringResultSchema,
  validateScoringResultForRequest
} from "./scoring-contract";
import { FakeScoringGateway, GeminiScoringGateway, VertexScoringGateway } from "./scoring-gateway";

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
  it("selects an ordered within-age candidate set without downward expansion", () => {
    const candidates = selectScoringCandidates(19, "IFSP");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.map((candidate) => candidate.sourceOrder)).toEqual(
      [...candidates].map((candidate) => candidate.sourceOrder).sort((left, right) => left - right)
    );
    expect(candidates.every((candidate) => candidate.alwaysAssess === true || (
      candidate.minimumAgeMonths <= 19 && candidate.maximumAgeMonths >= 19
    ))).toBe(true);
  });

  it("rejects educator-only credits in a model result", () => {
    const parsed = ScoringResultSchema.safeParse({
      contractVersion: SCORING_CONTRACT_VERSION,
      runId: "run-contract-1",
      outcome: "VALID",
      scoringConfigurationReference: "fixture:test",
      suggestions: [{
        id: "suggestion-1",
        sourceSkillId: "help-4.68",
        skillCode: "4.68",
        skillName: "Builds tower using two cubes",
        domain: "Fine Motor",
        strand: "Block construction",
        source: "MODEL",
        draftCredit: "NOT_APPLICABLE",
        confidence: 0.9,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 4, explanation: "Context only." }],
        sourceOrder: 0
      }]
    });
    expect(parsed.success).toBe(false);
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
        source: "MODEL" as const,
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

  it("sends the canonical GCS object to Vertex and validates its structured result", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        outcome: "VALID",
        suggestions: [{
          sourceSkillId: "help-4.68",
          draftCredit: "PRESENT",
          confidence: 0.92,
          uncertaintyReason: null,
          evidence: [{ timestampSeconds: 8, explanation: "Two cubes remain stacked." }]
        }]
      })
    });
    const gateway = new VertexScoringGateway({
      project: "test-project",
      location: "us-central1",
      model: "gemini-test",
      client: { models: { generateContent } }
    });

    const result = await gateway.score(request(), {
      kind: "gcs",
      uri: "gs://private-bucket/videos/source.mp4",
      generation: "123",
      contentType: "video/mp4"
    });

    expect(result.suggestions[0]).toMatchObject({ sourceSkillId: "help-4.68", draftCredit: "PRESENT" });
    expect(generateContent).toHaveBeenCalledOnce();
    const submitted = generateContent.mock.calls[0]![0];
    expect(submitted.contents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parts: expect.arrayContaining([
          expect.objectContaining({
            fileData: { fileUri: "gs://private-bucket/videos/source.mp4", mimeType: "video/mp4" },
            videoMetadata: { fps: 2 }
          })
        ])
      })
    ]));
    expect((submitted.config?.responseJsonSchema as { properties: { suggestions: object } })
      .properties.suggestions).not.toHaveProperty("maxItems");
  });

  it("runs separate grounded observation and catalogue-classification stages on Vertex", async () => {
    const generateContent = vi.fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          targetChildTrackable: true,
          limitations: [],
          events: [{
            eventId: "event-1",
            startSecond: 8,
            endSecond: 10,
            actor: "TARGET_CHILD",
            modality: "VISUAL",
            eventKind: "BEHAVIOR",
            supportLevel: "NONE_OBSERVED",
            behavior: "The child places one cube on another and releases it.",
            context: null
          }]
        })
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          evaluations: [{
            sourceSkillId: "help-4.68",
            draftCredit: "PRESENT",
            confidence: 0.92,
            uncertaintyReason: null,
            evidenceEventIds: ["event-1"]
          }]
        })
      });
    const gateway = new VertexScoringGateway({
      project: "test-project",
      location: "us-central1",
      model: "gemini-fallback",
      observerModel: "gemini-observer",
      adjudicatorModel: "gemini-adjudicator",
      pipeline: "evidence-first-v1",
      videoFps: 3,
      client: { models: { generateContent } }
    });

    const result = await gateway.score(request(), {
      kind: "gcs",
      uri: "gs://private-bucket/videos/source.mp4",
      contentType: "video/mp4"
    });

    expect(result.suggestions[0]).toMatchObject({
      sourceSkillId: "help-4.68",
      draftCredit: "PRESENT",
      evidence: [{ timestampSeconds: 8, endTimestampSeconds: 10 }]
    });
    expect(result.scoringConfigurationReference).toContain(
      "gemini-observer+gemini-adjudicator:help-reference-evidence-v1"
    );
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[0]![0]).toMatchObject({
      model: "gemini-observer",
      contents: [{
        parts: [
          expect.objectContaining({
            fileData: { fileUri: "gs://private-bucket/videos/source.mp4", mimeType: "video/mp4" },
            videoMetadata: { fps: 3 }
          }),
          expect.objectContaining({ text: expect.stringContaining("direct-observation ledger") })
        ]
      }],
      config: { systemInstruction: expect.stringContaining("evidence-observation stage") }
    });
    expect(generateContent.mock.calls[1]![0]).toMatchObject({
      model: "gemini-adjudicator",
      contents: [{ parts: [{ text: expect.stringContaining("<OBSERVATION_LEDGER>") }] }],
      config: { systemInstruction: expect.stringContaining("rubric-mapping stage") }
    });
  });

  it("rejects a non-GCS media source before calling Vertex", async () => {
    const generateContent = vi.fn();
    const gateway = new VertexScoringGateway({
      project: "test-project",
      location: "us-central1",
      model: "gemini-test",
      client: { models: { generateContent } }
    });

    await expect(gateway.score(request(), {
      kind: "bytes",
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "video/mp4"
    })).rejects.toMatchObject({ safeCode: "VIDEO_UNAVAILABLE", retryable: false });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it.each([
    [403, "SCORING_AUTHENTICATION_FAILED", false],
    [429, "SCORING_RATE_LIMITED", true],
    [504, "SCORING_TIMEOUT", true],
    [400, "SCORING_UNAVAILABLE", false]
  ] as const)("maps Vertex status %s to a safe failure", async (status, safeCode, retryable) => {
    const generateContent = vi.fn().mockRejectedValue(Object.assign(new Error("provider details"), { status }));
    const gateway = new VertexScoringGateway({
      project: "test-project",
      location: "us-central1",
      model: "gemini-test",
      client: { models: { generateContent } }
    });

    await expect(gateway.score(request(), {
      kind: "gcs",
      uri: "gs://private-bucket/videos/source.mp4",
      contentType: "video/mp4"
    })).rejects.toMatchObject({ safeCode, retryable });
  });
});
