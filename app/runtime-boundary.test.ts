import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const removedRuntimeFiles = [
  "app/dashboard/page.tsx",
  "app/videos/page.tsx",
  "app/review/page.tsx",
  "app/reliability/page.tsx",
  "app/prompts/page.tsx",
  "app/settings/page.tsx",
  "app/api/ai-runs/route.ts",
  "app/api/exports/[exportType]/route.ts",
  "app/api/human-ratings/import/route.ts",
  "app/api/prompts/route.ts",
  "app/api/reliability/route.ts",
  "app/api/review-overrides/route.ts",
  "app/api/rubric/route.ts",
  "app/api/videos/route.ts",
  "app/parents/page.tsx",
  "app/analytics/page.tsx",
  "app/reports/page.tsx",
  "app/catalog/page.tsx",
  "app/integrations/help-connect/page.tsx",
  "app/api/parents/route.ts",
  "app/api/analytics/route.ts",
  "app/api/reports/route.ts",
  "app/api/catalog/route.ts",
  "app/api/integrations/help-connect/route.ts"
];

describe("pilot runtime boundary", () => {
  it("keeps the assigned-child entry route", () => {
    expect(existsSync(join(process.cwd(), "app/children/page.tsx"))).toBe(true);
  });

  it.each(removedRuntimeFiles)("does not publish %s", (relativePath) => {
    expect(existsSync(join(process.cwd(), relativePath))).toBe(false);
  });
});
