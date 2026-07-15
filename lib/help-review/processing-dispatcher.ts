import { processRunById } from "./processing-coordinator";
import { configuredGcsBucket, googleCloudStorage } from "./gcs-storage";

export type ProcessingDispatchAdapter = "inline" | "http" | "gcs-event";

export function selectedProcessingDispatchAdapter(
  environment: NodeJS.ProcessEnv = process.env
): ProcessingDispatchAdapter {
  const adapter = environment.HELP_REVIEW_PROCESSING_ADAPTER ?? "inline";
  if (adapter === "inline" || adapter === "http" || adapter === "gcs-event") return adapter;
  throw new Error(`Unsupported processing dispatch adapter: ${adapter}`);
}

function processingMarker(runId: string): string {
  const prefix = (process.env.GCS_PROCESSING_REQUEST_PREFIX ?? "processing-requests/")
    .replace(/^\/+/, "")
    .replace(/\/*$/, "/");
  return `${prefix}${runId}.json`;
}

async function writeProcessingMarker(runId: string): Promise<void> {
  const bucket = googleCloudStorage().bucket(configuredGcsBucket());
  const marker = processingMarker(runId);
  try {
    await bucket.file(marker).save(JSON.stringify({ runId, requestedAt: new Date().toISOString() }), {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        cacheControl: "no-store",
        contentType: "application/json",
        metadata: { helpReviewKind: "processing-request", runId }
      }
    });
  } catch (error) {
    const status = (error as { readonly code?: number }).code;
    if (status !== 409 && status !== 412) throw error;
  }
}

async function callLocalProcessor(runId: string): Promise<void> {
  const baseUrl = process.env.HELP_REVIEW_PROCESSOR_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("HELP_REVIEW_PROCESSOR_URL is required for the HTTP processing adapter.");
  const secret = process.env.HELP_REVIEW_WORKER_SECRET;
  const response = await fetch(`${baseUrl}/internal/process/${encodeURIComponent(runId)}`, {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`The processor rejected the run dispatch (${response.status}).`);
}

export async function dispatchProcessingRun(runId: string): Promise<void> {
  const adapter = selectedProcessingDispatchAdapter();
  if (adapter === "inline") {
    await processRunById(runId);
    return;
  }
  if (adapter === "http") {
    await callLocalProcessor(runId);
    return;
  }
  await writeProcessingMarker(runId);
}

/** Durable marker creation is acknowledged before returning 202 to the browser. */
export function processingDispatchIsDurable(): boolean {
  return selectedProcessingDispatchAdapter() === "gcs-event";
}

export function runIdFromProcessingMarker(objectName: string): string | null {
  const prefix = (process.env.GCS_PROCESSING_REQUEST_PREFIX ?? "processing-requests/")
    .replace(/^\/+/, "")
    .replace(/\/*$/, "/");
  if (!objectName.startsWith(prefix) || !objectName.endsWith(".json")) return null;
  const runId = objectName.slice(prefix.length, -".json".length);
  return /^run-[0-9a-f-]{36}$/i.test(runId) ? runId : null;
}
