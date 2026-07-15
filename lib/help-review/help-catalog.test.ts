import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertConfiguredHelpCatalog,
  configuredHelpCatalog,
  DEFAULT_HELP_CATALOG_PATH,
  loadHelpCatalogFile,
  selectScoringCandidates
} from "./help-catalog";

const temporaryDirectories: string[] = [];

function temporaryCatalog(mutate: (catalog: Record<string, unknown>) => void): string {
  const directory = mkdtempSync(path.join(tmpdir(), "help-review-catalog-"));
  temporaryDirectories.push(directory);
  const catalog = JSON.parse(readFileSync(DEFAULT_HELP_CATALOG_PATH, "utf8")) as Record<string, unknown>;
  mutate(catalog);
  const filePath = path.join(directory, "catalog.json");
  writeFileSync(filePath, JSON.stringify(catalog), "utf8");
  return filePath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("versioned HELP catalogue", () => {
  it("loads the sanitized fixture with bounded metadata and a stable digest", () => {
    const loaded = loadHelpCatalogFile(
      DEFAULT_HELP_CATALOG_PATH,
      "help-2-provisional-2026-07",
      "7d604579d6c8f8fdf5ac0f3d0ef0643a1d4479806d6d6be38cb1bc2f92c451d2"
    );
    expect(loaded.catalog.status).toBe("SANITIZED_FIXTURE");
    expect(loaded.catalog.skills).toHaveLength(8);
    expect(loaded.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(loaded.absolutePath).not.toContain("..\u0000");
  });

  it("fails closed on version drift and duplicate identifiers", () => {
    expect(() => loadHelpCatalogFile(DEFAULT_HELP_CATALOG_PATH, "wrong-version"))
      .toThrow("does not match");
    expect(() => loadHelpCatalogFile(DEFAULT_HELP_CATALOG_PATH, undefined, "0".repeat(64)))
      .toThrow("digest does not match");

    const duplicatePath = temporaryCatalog((catalog) => {
      const skills = catalog.skills as Array<Record<string, unknown>>;
      skills[1].sourceSkillId = skills[0].sourceSkillId;
    });
    expect(() => loadHelpCatalogFile(duplicatePath)).toThrow("unique");
  });

  it("uses the configured policy and immutable source order for candidate selection", () => {
    const catalog = configuredHelpCatalog({ NODE_ENV: "test" });
    const candidates = selectScoringCandidates(19, "IFSP", catalog.skills, catalog);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.map((candidate) => candidate.sourceOrder))
      .toEqual([...candidates].map((candidate) => candidate.sourceOrder).sort((left, right) => left - right));
  });

  it("allows only an authoritative artifact in real-data mode", () => {
    expect(() => assertConfiguredHelpCatalog({ NODE_ENV: "production", HELP_REVIEW_REAL_DATA_ENABLED: "true" }))
      .toThrow("authoritative HELP catalogue");
    expect(() => assertConfiguredHelpCatalog({
      NODE_ENV: "production",
      HELP_REVIEW_REAL_DATA_ENABLED: "true",
      HELP_REVIEW_HELP_CATALOG_PATH: "tests/fixtures/help-catalog.authoritative-contract-test.json",
      HELP_REVIEW_HELP_CATALOG_VERSION: "help-contract-test-1",
      HELP_REVIEW_HELP_CATALOG_SHA256: "db976cffe239c99118eb40bed451b6fbb42e9a21da9c1fea8d1de66994cb2623"
    })).not.toThrow();
  });
});
