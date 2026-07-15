import "dotenv/config";

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

import { configuredGcsBucket } from "../lib/help-review/gcs-storage";
import {
  processRunById,
  RetryableProcessingError,
  type ProcessingTriggerContext
} from "../lib/help-review/processing-coordinator";
import { runIdFromProcessingMarker } from "../lib/help-review/processing-dispatcher";

interface StorageEventData {
  readonly bucket?: string;
  readonly name?: string;
  readonly generation?: string;
}

function json(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function authorizedInternalRequest(request: IncomingMessage): boolean {
  const expected = process.env.HELP_REVIEW_WORKER_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  const actual = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

async function readJson(request: IncomingMessage, limit = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > limit) throw new Error("Request body exceeds the processor limit.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function eventEnvelope(request: IncomingMessage, body: unknown): {
  readonly eventId: string | null;
  readonly data: StorageEventData;
} {
  const candidate = body as {
    readonly id?: string;
    readonly data?: StorageEventData;
    readonly bucket?: string;
    readonly name?: string;
    readonly generation?: string;
  };
  return {
    eventId: String(request.headers["ce-id"] ?? candidate.id ?? "") || null,
    data: candidate.data && typeof candidate.data === "object" ? candidate.data : candidate
  };
}

async function processEvent(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const event = eventEnvelope(request, await readJson(request));
  const expectedBucket = configuredGcsBucket();
  if (!event.data.name || event.data.bucket !== expectedBucket) {
    response.writeHead(204).end();
    return;
  }
  const runId = runIdFromProcessingMarker(event.data.name);
  if (!runId) {
    response.writeHead(204).end();
    return;
  }
  const trigger: ProcessingTriggerContext = {
    eventId: event.eventId,
    objectGeneration: event.data.generation ?? null,
    retryDelivery: true
  };
  const result = await processRunById(runId, trigger);
  if (result.disposition === "IN_PROGRESS") {
    json(response, 503, { retry: true });
    return;
  }
  response.writeHead(204).end();
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "GET" && url.pathname === "/healthz") {
    json(response, 200, { ok: true, service: "help-review-processor" });
    return;
  }
  if (request.method === "POST" && url.pathname === "/events/storage") {
    await processEvent(request, response);
    return;
  }
  const internalMatch = request.method === "POST"
    ? url.pathname.match(/^\/internal\/process\/(run-[0-9a-f-]{36})$/i)
    : null;
  if (internalMatch) {
    if (!authorizedInternalRequest(request)) {
      json(response, 401, { error: "Unauthorized." });
      return;
    }
    response.writeHead(202, { "Cache-Control": "no-store" }).end();
    void processRunById(internalMatch[1]).catch((error) => {
      console.error(JSON.stringify({
        event: "help_review_local_processor_failure",
        runId: internalMatch[1],
        message: error instanceof Error ? error.message : "Unknown processor failure"
      }));
    });
    return;
  }
  json(response, 404, { error: "Not found." });
}

export function createProcessorServer() {
  process.env.HELP_REVIEW_SERVICE_ROLE = "processor";
  return createServer((request, response) => {
    void route(request, response).catch((error) => {
      const retryable = error instanceof RetryableProcessingError;
      console.error(JSON.stringify({
        event: "help_review_processor_request_failure",
        retryable,
        safeCode: retryable ? error.safeCode : "PROCESSOR_REQUEST_FAILED"
      }));
      if (!response.headersSent) json(response, retryable ? 503 : 500, { retry: retryable });
      else response.end();
    });
  });
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? process.env.HELP_REVIEW_PROCESSOR_PORT ?? 8081);
  const server = createProcessorServer();
  server.listen(port, "0.0.0.0", () => {
    console.info(JSON.stringify({ event: "help_review_processor_started", port }));
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
