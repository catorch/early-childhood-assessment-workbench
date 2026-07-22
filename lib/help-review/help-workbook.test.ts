import path from "node:path";

import { describe, expect, it } from "vitest";

import { importHelpWorkbook, parseHelpAgeRange, parseSensoryCreditKeys } from "./help-workbook";

const workbookPath = path.join(
  process.cwd(),
  "docs",
  "HELP 0-3_2nd Ed_Strands and Skills List_Updated (1).xlsx"
);

describe("HELP workbook importer", () => {
  it.each([
    ["29-36+", 29, 216, true],
    ["24+", 24, 216, true],
    ["36", 36, 36, false],
    ["24–29.5", 24, 29.5, false],
    ["0.5–1.5", 0.5, 1.5, false]
  ] as const)("parses %s without losing half-month or open-ended meaning", (raw, minimum, maximum, openEnded) => {
    expect(parseHelpAgeRange(raw)).toEqual({
      minimumAgeMonths: minimum,
      maximumAgeMonths: maximum,
      openEnded
    });
  });

  it("keeps the A+/- sensory key distinct from A+", () => {
    expect(parseSensoryCreditKeys("A+/- when performance is emerging")).toEqual(["A_EMERGING"]);
    expect(parseSensoryCreditKeys("A+ for over-response; A- for under-response")).toEqual(["A_PLUS", "A_MINUS"]);
  });

  it("imports every workbook row in source order with duplicate display codes preserved", async () => {
    const catalog = await importHelpWorkbook(workbookPath, "help-workbook-test");
    expect(catalog.skills).toHaveLength(810);
    expect(new Set(catalog.skills.map((skill) => skill.strand)).size).toBe(62);
    expect(catalog.skills.filter((skill) => skill.alwaysAssess)).toHaveLength(18);
    expect(new Set(catalog.skills.map((skill) => skill.skillCode)).size).toBe(766);
    expect(new Set(catalog.skills.map((skill) => skill.sourceSkillId)).size).toBe(810);
    expect(catalog.skills.map((skill) => skill.sourceOrder)).toEqual(
      Array.from({ length: 810 }, (_, index) => index)
    );
    expect(new Set(catalog.skills.map((skill) => skill.domain)).size).toBe(9);
    expect(catalog.skills.filter((skill) => skill.domainCode === "0.0").every((skill) =>
      skill.isDevelopmentalDomain === false
    )).toBe(true);
    expect(catalog.skills.some((skill) => skill.domainCode === "0.0" && skill.sensoryCreditKeys?.includes("A_PLUS"))).toBe(true);
    expect(catalog.skills.some((skill) => skill.minimumAgeMonths % 1 === 0.5)).toBe(true);
    expect(catalog.skills.some((skill) => skill.rawAgeRange === "29–36+" && skill.maximumAgeMonths === 216)).toBe(true);
  });
});
