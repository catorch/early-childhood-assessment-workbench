/** Fails closed when sanitized adapters are accidentally used as a live deployment. */
export function assertRuntimeConfiguration(environment: NodeJS.ProcessEnv = process.env): void {
  if (
    environment.NODE_ENV === "production" &&
    environment.HELP_REVIEW_SANITIZED_PRODUCTION_ACK !== "true"
  ) {
    throw new Error(
      "Sanitized file, identity, video, and scoring adapters are not approved for production. " +
        "Select the approved provider adapters before enabling real data."
    );
  }
}
