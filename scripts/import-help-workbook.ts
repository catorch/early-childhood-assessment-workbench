import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { importHelpWorkbook } from "../lib/help-review/help-workbook";

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const input = path.resolve(argument(
  "--input",
  "docs/HELP 0-3_2nd Ed_Strands and Skills List_Updated (1).xlsx"
));
const output = path.resolve(argument("--output", "content/help-catalog.client-reference.json"));
const version = argument("--version", "help-0-3-workbook-2026-07-21");

async function main() {
  const catalog = await importHelpWorkbook(input, version);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Imported ${catalog.skills.length} HELP rows to ${output}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
