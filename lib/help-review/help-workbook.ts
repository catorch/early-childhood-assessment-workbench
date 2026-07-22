import { createHash } from "node:crypto";

import ExcelJS from "exceljs";

import { HelpCatalogSchema, type HelpCatalog } from "./help-catalog";

const OPEN_ENDED_MAXIMUM_MONTHS = 216;

export interface ParsedAgeRange {
  readonly minimumAgeMonths: number;
  readonly maximumAgeMonths: number;
  readonly openEnded: boolean;
}

export function parseHelpAgeRange(rawValue: string): ParsedAgeRange {
  const normalized = rawValue.trim().replace(/[–—−]/g, "-").replace(/\s+/g, "");
  const openEnded = normalized.endsWith("+");
  const withoutPlus = normalized.replace(/\+$/, "");
  const parts = withoutPlus.split("-");
  if (parts.length > 2 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) {
    throw new Error(`Unsupported HELP age range: ${rawValue}`);
  }
  const minimumAgeMonths = Number(parts[0]);
  const statedMaximum = Number(parts[1] ?? parts[0]);
  if (!Number.isFinite(minimumAgeMonths) || !Number.isFinite(statedMaximum) || statedMaximum < minimumAgeMonths) {
    throw new Error(`Invalid HELP age range: ${rawValue}`);
  }
  return {
    minimumAgeMonths,
    maximumAgeMonths: openEnded ? OPEN_ENDED_MAXIMUM_MONTHS : statedMaximum,
    openEnded
  };
}

function stableSourceSkillId(domain: string, strand: string, code: string, description: string): string {
  const digest = createHash("sha256")
    .update(`${domain}\u0000${strand}\u0000${code}\u0000${description}`)
    .digest("hex")
    .slice(0, 16);
  return `help-${code.replace(/[^a-zA-Z0-9.-]/g, "-")}-${digest}`;
}

export function parseSensoryCreditKeys(description: string): Array<"A_PLUS" | "A_MINUS" | "A_EMERGING"> {
  const keys: Array<"A_PLUS" | "A_MINUS" | "A_EMERGING"> = [];
  const withoutEmerging = description.replace(/A\+\/-/g, () => {
    keys.push("A_EMERGING");
    return "";
  });
  if (/A\+/.test(withoutEmerging)) keys.push("A_PLUS");
  if (/A-/.test(withoutEmerging)) keys.push("A_MINUS");
  return [...new Set(keys)];
}

export async function importHelpWorkbook(
  inputPath: string,
  catalogVersion = "help-0-3-workbook-2026-07-21"
): Promise<HelpCatalog> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The HELP workbook does not contain a worksheet.");

  const expectedHeaders = [
    "Domain",
    "Strand",
    "Skill ID",
    "Always Assess (*)",
    "Age Range (months)",
    "HELP Skill / Behavior Description"
  ];
  const headers = expectedHeaders.map((_, index) => worksheet.getCell(1, index + 1).text.trim());
  if (headers.some((header, index) => header !== expectedHeaders[index])) {
    throw new Error("The HELP workbook columns do not match the expected source format.");
  }

  const skills: HelpCatalog["skills"] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = Array.from({ length: 6 }, (_, index) => row.getCell(index + 1).text.trim());
    if (values.every((value) => value === "")) return;
    const [domain, strand, skillCode, alwaysAssessValue, rawAgeRange, skillName] = values;
    if (!domain || !strand || !skillCode || !rawAgeRange || !skillName) {
      throw new Error(`HELP workbook row ${rowNumber} is incomplete.`);
    }
    const domainCode = domain.match(/^\s*(\d+\.0)\b/)?.[1];
    if (!domainCode) throw new Error(`HELP workbook row ${rowNumber} has no domain code.`);
    const ageRange = parseHelpAgeRange(rawAgeRange);
    skills.push({
      sourceSkillId: stableSourceSkillId(domain, strand, skillCode, skillName),
      skillCode,
      skillName,
      domain,
      domainCode,
      isDevelopmentalDomain: domainCode !== "0.0",
      strand,
      rawAgeRange,
      minimumAgeMonths: ageRange.minimumAgeMonths,
      maximumAgeMonths: ageRange.maximumAgeMonths,
      alwaysAssess: /^yes$/i.test(alwaysAssessValue),
      sensoryCreditKeys: domainCode === "0.0" ? parseSensoryCreditKeys(skillName) : undefined,
      sourceOrder: skills.length,
      sourceFramework: "HELP 0-3, 2nd Edition"
    });
  });

  return HelpCatalogSchema.parse({
    schemaVersion: "help-catalog-v1",
    catalogVersion,
    status: "REFERENCE",
    sourceReference: "Client-supplied HELP 0-3, 2nd Edition strands and skills workbook; pending authoritative approval and full licensed credit notes.",
    attribution: "Imported deterministically in workbook order. Displayed skill codes are intentionally not unique.",
    disclaimer: "Reference content for client review. Do not enable real-data scoring until this artifact and the complete licensed credit criteria are approved as authoritative.",
    creditDefinitions: [
      { value: "PRESENT", symbol: "+", label: "Present", description: "The educator confirms that the skill criteria are met." },
      { value: "EMERGING", symbol: "+/-", label: "Emerging", description: "The educator confirms emerging performance toward the skill criteria." },
      { value: "NOT_OBSERVED", symbol: "-", label: "Not observed", description: "The skill was not observed despite a meaningful opportunity." },
      { value: "NOT_APPLICABLE", symbol: "N/A", label: "Not applicable", description: "The educator determines that the skill is not applicable." }
    ],
    selectionPolicy: {
      ageRangeInclusive: true,
      standardDownwardWindowMonths: 0,
      supportedDownwardWindowMonths: 0,
      fallbackCandidateCount: 1,
      maximumCandidateCount: 500,
      twoMinusRule: {
        enabled: false,
        consecutiveNotObserved: 2,
        decisionReference: "Pending final client/scientist confirmation; no stopping or inference rule is applied."
      }
    },
    skills
  });
}
