/** Fails closed when sanitized adapters are accidentally used as a live deployment. */
export function assertRuntimeConfiguration(environment: NodeJS.ProcessEnv = process.env): void {
  if (environment.NODE_ENV !== "production") return;
  const realDataEnabled = environment.HELP_REVIEW_REAL_DATA_ENABLED === "true";
  const identityAdapter = environment.HELP_REVIEW_IDENTITY_ADAPTER ?? "sandbox";
  const scoringAdapter = environment.HELP_REVIEW_SCORING_ADAPTER ?? "fake";
  const serviceRole = environment.HELP_REVIEW_SERVICE_ROLE ?? "web";
  const workerSecret = environment.HELP_REVIEW_WORKER_SECRET ?? environment.CRON_SECRET;
  if (realDataEnabled) {
    const missing = [
      "HELP_REVIEW_REAL_DATA_APPROVAL_ID",
      "HELP_REVIEW_IDENTITY_ADAPTER",
      "HELP_REVIEW_SCORING_ADAPTER"
    ].filter((key) => !environment[key]);
    if (!workerSecret) missing.push("HELP_REVIEW_WORKER_SECRET or CRON_SECRET");
    if (missing.length > 0) {
      throw new Error(`Real-data configuration is incomplete: ${missing.join(", ")}`);
    }
    if (identityAdapter === "sandbox") {
      throw new Error("The sandbox identity adapter is forbidden when real child data is enabled.");
    }
    if (scoringAdapter === "fake" || scoringAdapter === "gemini") {
      throw new Error("Sandbox scoring adapters are forbidden when real child data is enabled.");
    }
  } else if (environment.HELP_REVIEW_SANITIZED_PRODUCTION_ACK !== "true") {
    throw new Error(
      "Sanitized identity and scoring adapters are not approved for production. " +
        "Select the approved provider adapters before enabling real data."
    );
  }
  if (!new Set(["neon", "pg"]).has(environment.HELP_REVIEW_STATE_ADAPTER ?? "") || !environment.DATABASE_URL) {
    throw new Error("An acknowledged sanitized deployment must use the Neon state adapter or durable PostgreSQL adapter.");
  }
  if (serviceRole === "web") {
    if (!environment.HELP_REVIEW_SESSION_SECRET || environment.HELP_REVIEW_SESSION_SECRET.length < 32) {
      throw new Error("Production requires HELP_REVIEW_SESSION_SECRET with at least 32 characters.");
    }
    if (!environment.HELP_REVIEW_PLAYBACK_GRANT_SECRET || environment.HELP_REVIEW_PLAYBACK_GRANT_SECRET.length < 32) {
      throw new Error("Production requires HELP_REVIEW_PLAYBACK_GRANT_SECRET with at least 32 characters.");
    }
  }
  if (!workerSecret || workerSecret.length < 32) {
    throw new Error("Production requires HELP_REVIEW_WORKER_SECRET or CRON_SECRET with at least 32 characters.");
  }
  const videoAdapter = environment.HELP_REVIEW_VIDEO_ADAPTER;
  if (videoAdapter === "vercel-blob") {
    if (!environment.BLOB_READ_WRITE_TOKEN) {
      throw new Error("The private Vercel Blob adapter requires BLOB_READ_WRITE_TOKEN.");
    }
  } else if (videoAdapter === "gcs") {
    if (!environment.GCS_VIDEO_BUCKET || !(environment.GOOGLE_CLOUD_PROJECT || environment.GCLOUD_PROJECT)) {
      throw new Error("The GCS video adapter requires GCS_VIDEO_BUCKET and GOOGLE_CLOUD_PROJECT.");
    }
    if (serviceRole === "web" && (
      !environment.HELP_REVIEW_UPLOAD_GRANT_SECRET || environment.HELP_REVIEW_UPLOAD_GRANT_SECRET.length < 32
    )) {
      throw new Error("The GCS web service requires HELP_REVIEW_UPLOAD_GRANT_SECRET with at least 32 characters.");
    }
  } else {
    throw new Error("An acknowledged sanitized deployment must use an authenticated private Blob store or GCS bucket.");
  }
  if (identityAdapter !== "sandbox") {
    throw new Error("The selected live identity adapter is not implemented or approved.");
  }
  if (!new Set(["fake", "gemini", "vertex"]).has(scoringAdapter)) {
    throw new Error("The selected scoring adapter is not supported.");
  }
  if (scoringAdapter === "gemini" && !environment.GEMINI_API_KEY) {
    throw new Error("The Gemini scoring adapter requires GEMINI_API_KEY.");
  }
  if (scoringAdapter === "vertex" && !(environment.GOOGLE_CLOUD_PROJECT || environment.GCLOUD_PROJECT)) {
    throw new Error("The Vertex AI scoring adapter requires GOOGLE_CLOUD_PROJECT.");
  }
  const processingAdapter = environment.HELP_REVIEW_PROCESSING_ADAPTER ?? "inline";
  if (videoAdapter === "gcs" && serviceRole === "web" && processingAdapter !== "gcs-event") {
    throw new Error("The GCS web service must dispatch durable processing requests with the gcs-event adapter.");
  }
}
