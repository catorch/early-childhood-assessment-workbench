/** Fails closed when sanitized adapters are accidentally used as a live deployment. */
export function assertRuntimeConfiguration(environment: NodeJS.ProcessEnv = process.env): void {
  if (environment.NODE_ENV !== "production") return;
  if (environment.HELP_REVIEW_SANITIZED_PRODUCTION_ACK !== "true") {
    throw new Error(
      "Sanitized identity and scoring adapters are not approved for production. " +
        "Select the approved provider adapters before enabling real data."
    );
  }
  if (environment.HELP_REVIEW_STATE_ADAPTER !== "neon" || !environment.DATABASE_URL) {
    throw new Error("An acknowledged sanitized deployment must use the Neon state adapter.");
  }
  if (
    environment.HELP_REVIEW_VIDEO_ADAPTER !== "vercel-blob" ||
    !environment.BLOB_READ_WRITE_TOKEN
  ) {
    throw new Error("An acknowledged sanitized deployment must use an authenticated private Blob store.");
  }
}
