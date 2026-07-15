import { GoogleGenAI } from "@google/genai";

import { createFakeScoringResult } from "./fake-scoring";
import {
  ScoringGatewayError,
  ScoringRequestSchema,
  ScoringResultSchema,
  validateScoringResultForRequest,
  type ScoringGateway,
  type ScoringMedia,
  type ScoringRequest,
  type ScoringResult
} from "./scoring-contract";

export class FakeScoringGateway implements ScoringGateway {
  readonly name = "fake";

  constructor(private readonly scenario: FakeScoringScenario = "accepted") {}

  async score(request: ScoringRequest, media: ScoringMedia): Promise<ScoringResult> {
    void media;
    const validated = ScoringRequestSchema.parse(request);
    if (this.scenario === "slow") await new Promise((resolve) => setTimeout(resolve, 50));
    if (this.scenario === "retryable-failure") {
      throw new ScoringGatewayError("Synthetic retryable failure.", "SCORING_UNAVAILABLE", true);
    }
    if (this.scenario === "terminal-failure") {
      throw new ScoringGatewayError("Synthetic terminal failure.", "SCORING_AUTHENTICATION_FAILED", false);
    }
    if (["invalid-credit", "invalid-evidence", "empty-result"].includes(this.scenario)) {
      throw new ScoringGatewayError("Synthetic invalid contract response.", "INVALID_RESULT", false);
    }
    if (this.scenario === "no-valid-results") {
      return ScoringResultSchema.parse({
        contractVersion: validated.contractVersion,
        runId: validated.runId,
        outcome: "NO_VALID_RESULTS",
        scoringConfigurationReference: "fake:sandbox-v1:no-valid-results",
        suggestions: []
      });
    }
    const suggestions = createFakeScoringResult(validated.runId).filter((suggestion) =>
      validated.candidates.some((candidate) => candidate.sourceSkillId === suggestion.sourceSkillId)
    );
    const selected = this.scenario === "uncertain"
      ? suggestions.filter((suggestion) => suggestion.draftCredit === null)
      : suggestions;
    return validateScoringResultForRequest(validated, ScoringResultSchema.parse({
      contractVersion: validated.contractVersion,
      runId: validated.runId,
      outcome: selected.length > 0 ? "VALID" : "NO_VALID_RESULTS",
      scoringConfigurationReference: "fake:sandbox-v1:help-2-provisional-2026-07",
      suggestions: selected.map((suggestion) => {
        const maximumSecond = validated.video.durationSeconds ?? 5 * 60;
        return {
          ...suggestion,
          sourceOrder: validated.candidates.find((candidate) => candidate.sourceSkillId === suggestion.sourceSkillId)!.sourceOrder,
          evidence: suggestion.evidence.map((evidence) => ({
            ...evidence,
            timestampSeconds: Math.min(evidence.timestampSeconds, maximumSecond),
            endTimestampSeconds: evidence.endTimestampSeconds === undefined
              ? undefined
              : Math.min(evidence.endTimestampSeconds, maximumSecond)
          }))
        };
      })
    }));
  }
}

export type FakeScoringScenario =
  | "accepted"
  | "uncertain"
  | "no-valid-results"
  | "invalid-credit"
  | "invalid-evidence"
  | "empty-result"
  | "slow"
  | "retryable-failure"
  | "terminal-failure";

interface GeminiFile {
  readonly name: string;
  readonly uri: string;
  readonly mimeType?: string;
  readonly state?: string;
}

interface GeminiGatewayOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function responseSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["outcome", "suggestions"],
    properties: {
      outcome: { type: "string", enum: ["VALID", "NO_VALID_RESULTS"] },
      suggestions: {
        type: "array",
        // Vertex rejects maxItems on this nested response schema. The Zod
        // contract and one-megabyte result limit enforce the same bound.
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sourceSkillId", "draftCredit", "confidence", "uncertaintyReason", "evidence"],
          properties: {
            sourceSkillId: { type: "string" },
            draftCredit: {
              anyOf: [
                { type: "string", enum: ["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"] },
                { type: "null" }
              ]
            },
            confidence: { anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }] },
            uncertaintyReason: { anyOf: [{ type: "string" }, { type: "null" }] },
            evidence: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["timestampSeconds", "explanation"],
                properties: {
                  timestampSeconds: { type: "integer", minimum: 0 },
                  endTimestampSeconds: { type: "integer", minimum: 0 },
                  explanation: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  };
}

function scoringPrompt(request: ScoringRequest): string {
  const candidates = request.candidates.map((candidate) => ({
    sourceSkillId: candidate.sourceSkillId,
    skillCode: candidate.skillCode,
    skillName: candidate.skillName,
    domain: candidate.domain,
    strand: candidate.strand,
    ageRangeMonths: [candidate.minimumAgeMonths, candidate.maximumAgeMonths],
    sourceOrder: candidate.sourceOrder
  }));
  return [
    "You are producing provisional HELP Review decision-support suggestions from one sanitized observation video.",
    "Never invent a skill. Use only sourceSkillId values in the supplied candidate list.",
    "The educator remains the final decision maker. If evidence is insufficient, set draftCredit to null and provide uncertaintyReason.",
    "Return timestamped, directly observable evidence. Do not infer diagnoses, intent, identity, or unobserved behavior.",
    "Use age order as context, but do not apply an unconfirmed two-consecutive-minus stopping rule.",
    JSON.stringify({ observation: request.observation, candidates })
  ].join("\n\n");
}

function mapGeminiFailure(status: number): ScoringGatewayError {
  if (status === 401 || status === 403) {
    return new ScoringGatewayError("Gemini authentication failed.", "SCORING_AUTHENTICATION_FAILED", false);
  }
  if (status === 429) {
    return new ScoringGatewayError("Gemini rate limited the request.", "SCORING_RATE_LIMITED", true);
  }
  return new ScoringGatewayError("Gemini was unavailable.", "SCORING_UNAVAILABLE", status >= 500);
}

export class GeminiScoringGateway implements ScoringGateway {
  readonly name = "gemini-sandbox";
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: GeminiGatewayOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 180_000;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      const response = await this.fetchImplementation(url, {
        ...init,
        headers: { "x-goog-api-key": this.options.apiKey, ...init.headers },
        signal: init.signal ?? timeoutSignal(this.timeoutMs)
      });
      if (!response.ok) throw mapGeminiFailure(response.status);
      return response;
    } catch (error) {
      if (error instanceof ScoringGatewayError) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new ScoringGatewayError("Gemini timed out.", "SCORING_TIMEOUT", true);
      }
      throw new ScoringGatewayError("Gemini could not be reached.", "SCORING_UNAVAILABLE", true);
    }
  }

  private async upload(media: ScoringMedia, displayName: string): Promise<GeminiFile> {
    if (media.kind !== "bytes") {
      throw new ScoringGatewayError(
        "The Gemini Files adapter requires direct video bytes.",
        "VIDEO_UNAVAILABLE",
        false
      );
    }
    const start = await this.request("https://generativelanguage.googleapis.com/upload/v1beta/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(media.bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": media.contentType
      },
      body: JSON.stringify({ file: { display_name: displayName } })
    });
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      throw new ScoringGatewayError("Gemini did not issue an upload URL.", "SCORING_UNAVAILABLE", true);
    }
    const uploaded = await this.request(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(media.bytes.byteLength),
        "Content-Type": media.contentType,
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize"
      },
      body: new Blob([media.bytes.slice().buffer as ArrayBuffer], { type: media.contentType })
    });
    const payload = await uploaded.json() as { readonly file?: GeminiFile };
    if (!payload.file?.name || !payload.file.uri) {
      throw new ScoringGatewayError("Gemini returned invalid upload metadata.", "SCORING_UNAVAILABLE", true);
    }
    return payload.file;
  }

  private async waitForFile(file: GeminiFile): Promise<GeminiFile> {
    const deadline = Date.now() + this.timeoutMs;
    let current = file;
    while (current.state === "PROCESSING" || !current.state) {
      if (Date.now() >= deadline) {
        throw new ScoringGatewayError("Gemini file processing timed out.", "SCORING_TIMEOUT", true);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      const response = await this.request(`https://generativelanguage.googleapis.com/v1beta/${current.name}`, { method: "GET" });
      current = await response.json() as GeminiFile;
    }
    if (current.state !== "ACTIVE") {
      throw new ScoringGatewayError("Gemini rejected the video input.", "VIDEO_UNAVAILABLE", false);
    }
    return current;
  }

  private async removeFile(file: GeminiFile): Promise<void> {
    try {
      await this.request(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { method: "DELETE" });
    } catch {
      // Cleanup is best effort; the provider retention policy remains authoritative.
    }
  }

  async score(unparsedRequest: ScoringRequest, media: ScoringMedia): Promise<ScoringResult> {
    const request = ScoringRequestSchema.parse(unparsedRequest);
    let file: GeminiFile | undefined;
    try {
      file = await this.waitForFile(await this.upload(media, request.runId));
      const response = await this.request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { fileData: { fileUri: file.uri, mimeType: file.mimeType ?? media.contentType } },
                { text: scoringPrompt(request) }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseJsonSchema: responseSchema()
            }
          })
        }
      );
      const payload = await response.json() as {
        readonly candidates?: ReadonlyArray<{
          readonly content?: { readonly parts?: ReadonlyArray<{ readonly text?: string }> };
        }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      if (!text) {
        throw new ScoringGatewayError("Gemini returned no structured result.", "INVALID_RESULT", false);
      }
      const raw = JSON.parse(text) as {
        readonly outcome: "VALID" | "NO_VALID_RESULTS";
        readonly suggestions: ReadonlyArray<{
          readonly sourceSkillId: string;
          readonly draftCredit: string | null;
          readonly confidence: number | null;
          readonly uncertaintyReason: string | null;
          readonly evidence: unknown;
        }>;
      };
      const candidateById = new Map(request.candidates.map((candidate) => [candidate.sourceSkillId, candidate]));
      return validateScoringResultForRequest(request, ScoringResultSchema.parse({
        contractVersion: request.contractVersion,
        runId: request.runId,
        outcome: raw.outcome,
        scoringConfigurationReference: `gemini:${this.options.model}:help-v0:${request.catalogVersion}`,
        suggestions: raw.suggestions.map((suggestion, index) => {
          const candidate = candidateById.get(suggestion.sourceSkillId);
          if (!candidate) throw new Error("The model returned a skill outside the candidate allowlist.");
          return {
            id: `${request.runId}-suggestion-${index + 1}`,
            sourceSkillId: candidate.sourceSkillId,
            skillCode: candidate.skillCode,
            skillName: candidate.skillName,
            domain: candidate.domain,
            strand: candidate.strand,
            draftCredit: suggestion.draftCredit,
            confidence: suggestion.confidence,
            uncertaintyReason: suggestion.uncertaintyReason,
            evidence: suggestion.evidence,
            sourceOrder: candidate.sourceOrder
          };
        })
      }));
    } catch (error) {
      if (error instanceof ScoringGatewayError) throw error;
      throw new ScoringGatewayError("The scoring response failed validation.", "INVALID_RESULT", false);
    } finally {
      if (file) await this.removeFile(file);
    }
  }
}

interface VertexGatewayOptions {
  readonly project: string;
  readonly location: string;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly client?: VertexModelClient;
}

interface VertexModelClient {
  readonly models: {
    generateContent(
      parameters: Parameters<GoogleGenAI["models"]["generateContent"]>[0]
    ): Promise<{ readonly text?: string }>;
  };
}

function modelResult(
  request: ScoringRequest,
  text: string,
  scoringConfigurationReference: string
): ScoringResult {
  const raw = JSON.parse(text) as {
    readonly outcome: "VALID" | "NO_VALID_RESULTS";
    readonly suggestions: ReadonlyArray<{
      readonly sourceSkillId: string;
      readonly draftCredit: string | null;
      readonly confidence: number | null;
      readonly uncertaintyReason: string | null;
      readonly evidence: unknown;
    }>;
  };
  const candidateById = new Map(request.candidates.map((candidate) => [candidate.sourceSkillId, candidate]));
  return validateScoringResultForRequest(request, ScoringResultSchema.parse({
    contractVersion: request.contractVersion,
    runId: request.runId,
    outcome: raw.outcome,
    scoringConfigurationReference,
    suggestions: raw.suggestions.map((suggestion, index) => {
      const candidate = candidateById.get(suggestion.sourceSkillId);
      if (!candidate) throw new Error("The model returned a skill outside the candidate allowlist.");
      return {
        id: `${request.runId}-suggestion-${index + 1}`,
        sourceSkillId: candidate.sourceSkillId,
        skillCode: candidate.skillCode,
        skillName: candidate.skillName,
        domain: candidate.domain,
        strand: candidate.strand,
        draftCredit: suggestion.draftCredit,
        confidence: suggestion.confidence,
        uncertaintyReason: suggestion.uncertaintyReason,
        evidence: suggestion.evidence,
        sourceOrder: candidate.sourceOrder
      };
    })
  }));
}

function vertexFailure(error: unknown): ScoringGatewayError {
  const candidate = error as { readonly status?: number; readonly code?: number; readonly name?: string };
  const status = candidate.status ?? candidate.code;
  if (status === 401 || status === 403) {
    return new ScoringGatewayError("Vertex AI authentication failed.", "SCORING_AUTHENTICATION_FAILED", false);
  }
  if (status === 429) {
    return new ScoringGatewayError("Vertex AI rate limited the request.", "SCORING_RATE_LIMITED", true);
  }
  if (status === 408 || status === 504 || candidate.name === "TimeoutError") {
    return new ScoringGatewayError("Vertex AI timed out.", "SCORING_TIMEOUT", true);
  }
  return new ScoringGatewayError("Vertex AI was unavailable.", "SCORING_UNAVAILABLE", !status || status >= 500);
}

/** Production scoring adapter. Vertex reads the canonical private GCS object in place. */
export class VertexScoringGateway implements ScoringGateway {
  readonly name = "vertex";
  private readonly client: VertexModelClient;

  constructor(private readonly options: VertexGatewayOptions) {
    this.client = options.client ?? new GoogleGenAI({
      vertexai: true,
      project: options.project,
      location: options.location,
      apiVersion: "v1"
    });
  }

  async score(unparsedRequest: ScoringRequest, media: ScoringMedia): Promise<ScoringResult> {
    const request = ScoringRequestSchema.parse(unparsedRequest);
    if (media.kind !== "gcs") {
      throw new ScoringGatewayError(
        "Vertex AI requires the canonical Google Cloud Storage object.",
        "VIDEO_UNAVAILABLE",
        false
      );
    }
    try {
      const response = await this.client.models.generateContent({
        model: this.options.model,
        contents: [{
          role: "user",
          parts: [
            { fileData: { fileUri: media.uri, mimeType: media.contentType } },
            { text: scoringPrompt(request) }
          ]
        }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 8_192,
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema(),
          httpOptions: { timeout: this.options.timeoutMs ?? 180_000 }
        }
      });
      if (!response.text) {
        throw new ScoringGatewayError("Vertex AI returned no structured result.", "INVALID_RESULT", false);
      }
      return modelResult(
        request,
        response.text,
        `vertex:${this.options.location}:${this.options.model}:help-v0:${request.catalogVersion}`
      );
    } catch (error) {
      if (error instanceof ScoringGatewayError) throw error;
      if (error instanceof SyntaxError || (error instanceof Error && /candidate|validation|result/i.test(error.message))) {
        throw new ScoringGatewayError("The Vertex AI result failed validation.", "INVALID_RESULT", false);
      }
      throw vertexFailure(error);
    }
  }
}

export function selectedScoringGateway(environment: NodeJS.ProcessEnv = process.env): ScoringGateway {
  const adapter = environment.HELP_REVIEW_SCORING_ADAPTER ?? "fake";
  if (adapter === "fake") {
    const scenario = environment.HELP_REVIEW_FAKE_SCORING_SCENARIO ?? "accepted";
    const accepted = new Set<FakeScoringScenario>([
      "accepted", "uncertain", "no-valid-results", "invalid-credit", "invalid-evidence",
      "empty-result", "slow", "retryable-failure", "terminal-failure"
    ]);
    if (!accepted.has(scenario as FakeScoringScenario)) throw new Error(`Unsupported fake scoring scenario: ${scenario}`);
    return new FakeScoringGateway(scenario as FakeScoringScenario);
  }
  if (adapter === "gemini") {
    const apiKey = environment.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required for the Gemini scoring adapter.");
    return new GeminiScoringGateway({
      apiKey,
      model: environment.GEMINI_MODEL ?? "gemini-2.5-flash"
    });
  }
  if (adapter === "vertex") {
    const project = environment.GOOGLE_CLOUD_PROJECT || environment.GCLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is required for the Vertex AI scoring adapter.");
    return new VertexScoringGateway({
      project,
      location: environment.VERTEX_AI_LOCATION ?? "us-central1",
      model: environment.VERTEX_AI_MODEL ?? "gemini-2.5-flash"
    });
  }
  throw new Error(`Unsupported scoring adapter: ${adapter}`);
}
