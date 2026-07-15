import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  rosterImportService,
  RosterImportValidationError
} from "../lib/help-review/roster-import";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({
    args,
    options: {
      file: { type: "string", short: "f" },
      "actor-id": { type: "string" },
      apply: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false }
    },
    strict: true
  });

  if (values.help) {
    console.log("Usage: pnpm roster:import -- --file <roster.csv> --actor-id <active-admin-id> [--apply]");
    console.log("Without --apply, the command validates and previews the import without writing state.");
    return;
  }

  if (!values.file || !values["actor-id"]) {
    console.error("Both --file and --actor-id are required. Use --help for usage.");
    process.exitCode = 1;
    return;
  }

  try {
    const input = await readFile(resolve(values.file));
    const summary = await rosterImportService.run(input, {
      actorId: values["actor-id"],
      dryRun: !values.apply
    });
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (error instanceof RosterImportValidationError) {
      console.error(JSON.stringify({ error: error.message, issues: error.issues }, null, 2));
    } else {
      console.error("The roster import could not be completed.");
    }
    process.exitCode = 1;
  }
}

void main();
