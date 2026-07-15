import "dotenv/config";

import { loadHelpCatalogFile } from "../lib/help-review/help-catalog";

function selectedPath(): string {
  const argument = process.argv.slice(2).find((value) => !value.startsWith("--"));
  const filePath = argument ?? process.env.HELP_REVIEW_HELP_CATALOG_PATH;
  if (!filePath) {
    throw new Error("Provide a catalogue path or set HELP_REVIEW_HELP_CATALOG_PATH.");
  }
  return filePath;
}

try {
  const loaded = loadHelpCatalogFile(
    selectedPath(),
    process.env.HELP_REVIEW_HELP_CATALOG_VERSION,
    process.env.HELP_REVIEW_HELP_CATALOG_SHA256
  );
  process.stdout.write(`${JSON.stringify({
    valid: true,
    schemaVersion: loaded.catalog.schemaVersion,
    catalogVersion: loaded.catalog.catalogVersion,
    status: loaded.catalog.status,
    skills: loaded.catalog.skills.length,
    bytes: loaded.byteSize,
    sha256: loaded.sha256
  })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "The HELP catalogue could not be validated."}\n`);
  process.exitCode = 1;
}
