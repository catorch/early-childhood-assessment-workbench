import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { PrimaryCreditSchema } from "./domain";
import {
  HELP_CATALOG_VERSION,
  ScoringCandidateSchema,
  type ScoringCandidate,
  type SupportContext
} from "./scoring-contract";

export const HELP_CATALOG_SCHEMA_VERSION = "help-catalog-v1" as const;
export const DEFAULT_HELP_CATALOG_PATH = "content/help-catalog.sanitized.json";
const MAX_CATALOG_BYTES = 10 * 1024 * 1024;

const CreditDefinitionSchema = z.object({
  value: PrimaryCreditSchema,
  symbol: z.string().trim().min(1).max(8),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2_000)
}).strict();

export const HelpCatalogSchema = z.object({
  schemaVersion: z.literal(HELP_CATALOG_SCHEMA_VERSION),
  catalogVersion: z.string().trim().min(1).max(160),
  status: z.enum(["SANITIZED_FIXTURE", "REFERENCE", "AUTHORITATIVE"]),
  sourceReference: z.string().trim().min(1).max(500),
  attribution: z.string().trim().min(1).max(2_000).optional(),
  disclaimer: z.string().trim().min(1).max(2_000).optional(),
  sourceReferences: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(500),
    url: z.url().max(1_000),
    retrievedDate: z.iso.date()
  }).strict()).max(100).optional(),
  creditDefinitions: z.array(CreditDefinitionSchema).length(4),
  selectionPolicy: z.object({
    ageRangeInclusive: z.literal(true),
    standardDownwardWindowMonths: z.number().int().min(0).max(36),
    supportedDownwardWindowMonths: z.number().int().min(0).max(36),
    fallbackCandidateCount: z.number().int().min(1).max(500),
    maximumCandidateCount: z.number().int().min(1).max(500),
    twoMinusRule: z.object({
      enabled: z.boolean(),
      consecutiveNotObserved: z.number().int().min(1).max(10),
      decisionReference: z.string().trim().min(1).max(500)
    }).strict()
  }).strict(),
  skills: z.array(ScoringCandidateSchema).min(1).max(25_000)
}).strict().superRefine((catalog, context) => {
  const requiredCredits = new Set(["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"]);
  const credits = new Set(catalog.creditDefinitions.map((definition) => definition.value));
  if (credits.size !== requiredCredits.size || [...requiredCredits].some((credit) => !credits.has(credit as never))) {
    context.addIssue({
      code: "custom",
      path: ["creditDefinitions"],
      message: "The catalogue must define each supported credit exactly once."
    });
  }

  const ids = new Set<string>();
  const codes = new Set<string>();
  const orders = new Set<number>();
  for (const skill of catalog.skills) {
    if (ids.has(skill.sourceSkillId) || codes.has(skill.skillCode) || orders.has(skill.sourceOrder)) {
      context.addIssue({
        code: "custom",
        path: ["skills"],
        message: "Skill identifiers, codes, and source order values must be unique."
      });
      return;
    }
    ids.add(skill.sourceSkillId);
    codes.add(skill.skillCode);
    orders.add(skill.sourceOrder);
  }
});

export type HelpCatalog = z.infer<typeof HelpCatalogSchema>;

export interface LoadedHelpCatalog {
  readonly catalog: HelpCatalog;
  readonly sha256: string;
  readonly byteSize: number;
  readonly absolutePath: string;
}

function absoluteCatalogPath(filePath: string): string {
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), filePath);
}

export function loadHelpCatalogFile(
  filePath: string,
  expectedVersion?: string,
  expectedSha256?: string
): LoadedHelpCatalog {
  const absolutePath = absoluteCatalogPath(filePath);
  const metadata = statSync(absolutePath);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_CATALOG_BYTES) {
    throw new Error("The HELP catalogue file is empty, unavailable, or exceeds the 10 MB limit.");
  }
  const bytes = readFileSync(absolutePath);
  let unparsed: unknown;
  try {
    unparsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("The HELP catalogue is not valid UTF-8 JSON.");
  }
  const catalog = HelpCatalogSchema.parse(unparsed);
  if (expectedVersion && catalog.catalogVersion !== expectedVersion) {
    throw new Error("The HELP catalogue version does not match the configured immutable version.");
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) {
    throw new Error("The HELP catalogue digest does not match the accepted immutable artifact.");
  }
  return {
    catalog,
    sha256,
    byteSize: bytes.byteLength,
    absolutePath
  };
}

let configuredCache: { key: string; loaded: LoadedHelpCatalog } | null = null;

/** Loads the single immutable catalogue selected for this application image. */
export function configuredHelpCatalog(environment: NodeJS.ProcessEnv = process.env): HelpCatalog {
  const filePath = environment.HELP_REVIEW_HELP_CATALOG_PATH ?? DEFAULT_HELP_CATALOG_PATH;
  const expectedVersion = environment.HELP_REVIEW_HELP_CATALOG_VERSION ?? HELP_CATALOG_VERSION;
  const expectedSha256 = environment.HELP_REVIEW_HELP_CATALOG_SHA256;
  const key = `${absoluteCatalogPath(filePath)}\u0000${expectedVersion}\u0000${expectedSha256 ?? ""}`;
  if (!configuredCache || configuredCache.key !== key) {
    configuredCache = { key, loaded: loadHelpCatalogFile(filePath, expectedVersion, expectedSha256) };
  }
  return configuredCache.loaded.catalog;
}

export function assertConfiguredHelpCatalog(environment: NodeJS.ProcessEnv = process.env): void {
  const catalog = configuredHelpCatalog(environment);
  if (environment.HELP_REVIEW_REAL_DATA_ENABLED === "true" && catalog.status !== "AUTHORITATIVE") {
    throw new Error("Real-data mode requires an authoritative HELP catalogue artifact.");
  }
}

function selectionPolicyFor(
  supportContext: SupportContext,
  catalog: HelpCatalog
): { downwardWindow: number; fallbackCount: number; maximumCount: number } {
  return {
    downwardWindow: supportContext === "NONE_REPORTED"
      ? catalog.selectionPolicy.standardDownwardWindowMonths
      : catalog.selectionPolicy.supportedDownwardWindowMonths,
    fallbackCount: catalog.selectionPolicy.fallbackCandidateCount,
    maximumCount: catalog.selectionPolicy.maximumCandidateCount
  };
}

/** Age-first selection with bounded downward expansion in the immutable catalogue order. */
export function selectScoringCandidates(
  ageMonths: number,
  supportContext: SupportContext,
  candidates?: readonly ScoringCandidate[],
  policyCatalog?: HelpCatalog
): readonly ScoringCandidate[] {
  const catalog = policyCatalog ?? configuredHelpCatalog();
  const source = (candidates ?? catalog.skills).filter(
    (candidate) => candidate.videoScoreability !== "NOT_RELIABLY_SCOREABLE"
  );
  const policy = selectionPolicyFor(supportContext, catalog);
  const ageAppropriate = source.filter(
    (candidate) => ageMonths >= candidate.minimumAgeMonths && ageMonths <= candidate.maximumAgeMonths
  );
  const downward = source.filter(
    (candidate) =>
      candidate.maximumAgeMonths < ageMonths &&
      candidate.maximumAgeMonths >= Math.max(0, ageMonths - policy.downwardWindow)
  );
  const closestLower = source
    .filter((candidate) => candidate.maximumAgeMonths < ageMonths)
    .sort((left, right) => right.maximumAgeMonths - left.maximumAgeMonths)
    .slice(0, policy.fallbackCount);
  const selected = ageAppropriate.length > 0
    ? [...ageAppropriate, ...downward]
    : downward.length > 0
      ? downward
      : closestLower.length > 0
        ? closestLower
        : source;
  return [...new Map(selected.map((candidate) => [candidate.sourceSkillId, candidate])).values()]
    .sort((left, right) => left.sourceOrder - right.sourceOrder)
    .slice(0, policy.maximumCount);
}
