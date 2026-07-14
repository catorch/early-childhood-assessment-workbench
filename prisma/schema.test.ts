import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(process.cwd(), "prisma/migrations/20260713150000_help_review_pilot/migration.sql"),
  "utf8"
);

function declarations(kind: "model" | "enum") {
  return [...schema.matchAll(new RegExp(`^${kind}\\s+(\\w+)`, "gm"))].map((match) => match[1]);
}

describe("lean pilot schema boundary", () => {
  it("contains only the twelve pilot models", () => {
    expect(declarations("model").sort()).toEqual(
      [
        "Assessment",
        "Child",
        "ChildAssignment",
        "AccessProvision",
        "ProcessingRun",
        "ReviewDecision",
        "Session",
        "SkillSuggestion",
        "SupportEvent",
        "User",
        "VideoAsset",
        "VideoAccessGrantRecord"
      ].sort()
    );
  });

  it("does not restore excluded workbench concepts", () => {
    for (const forbidden of [
      "Organization",
      "Batch",
      "PromptVersion",
      "HumanRating",
      "ReliabilityReport",
      "DalRuleSet",
      "ExportJob",
      "ReportArtifact",
      "MANUALLY_ADDED",
      "tokenExpiresAt"
    ]) {
      expect(schema).not.toContain(forbidden);
    }
  });

  it("defines only Educator and Admin roles", () => {
    const roleBody = schema.match(/enum Role \{([\s\S]*?)\}/)?.[1];
    const roles = roleBody
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    expect(roles).toEqual(["EDUCATOR", "ADMIN"]);
  });

  it("stores revisions and playback audit records without grant secrets", () => {
    expect(schema).toContain("revision        Int");
    expect(schema).toContain("model VideoAccessGrantRecord");
    expect(schema).toContain("viewerId      String");
    expect(schema).not.toContain("grantToken");
    expect(schema).not.toContain("playbackUrl");
  });

  it("ships database constraints for finalization and decision invariants", () => {
    expect(migration).toContain("Assessment_finalization_check");
    expect(migration).toContain("ReviewDecision_credit_check");
    expect(migration).toContain("VideoAccessGrantRecord_expiry_check");
  });
});
