import "dotenv/config";

import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import pg from "pg";

const { Client } = pg;

function safeDiagnostic(value: string | undefined): string {
  return (value ?? "No diagnostic was returned.")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL redacted]")
    .replace(/password=\S+/gi, "password=[redacted]")
    .trim()
    .split("\n")
    .slice(0, 4)
    .join(" ");
}

function postgresEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGCONNECT_TIMEOUT: "15",
    PGAPPNAME: "help-review-recovery-drill"
  };
  const sslMode = url.searchParams.get("sslmode");
  const channelBinding = url.searchParams.get("channel_binding");
  if (sslMode) environment.PGSSLMODE = sslMode;
  if (channelBinding) environment.PGCHANNELBINDING = channelBinding;
  return environment;
}

function run(command: string, args: string[], environment: NodeJS.ProcessEnv, step: string): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    encoding: "utf8",
    timeout: 120_000
  });
  if (result.status !== 0) {
    throw new Error(`${step} failed: ${safeDiagnostic(result.stderr || result.error?.message)}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({
    args,
    options: {
      "confirm-temporary-schema": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false }
    },
    strict: true
  });
  if (values.help) {
    console.log("Usage: pnpm db:recovery-drill -- --confirm-temporary-schema");
    console.log("Creates, dumps, drops, restores, verifies, and removes one isolated temporary schema.");
    return;
  }
  if (!values["confirm-temporary-schema"]) {
    console.error("Pass --confirm-temporary-schema to run the isolated recovery drill.");
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DIRECT_URL or DATABASE_URL is required.");
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const schema = `help_review_recovery_${startedAt}`;
  const markerId = `child-recovery-${startedAt}`;
  const directory = await mkdtemp(join(tmpdir(), "help-review-recovery-"));
  const archive = join(directory, "recovery.dump");
  const dumpBinary = process.env.PG_DUMP_BIN ?? "pg_dump";
  const restoreBinary = process.env.PG_RESTORE_BIN ?? "pg_restore";
  const client = new Client({ connectionString: databaseUrl });
  let connected = false;
  let phase = "connect to database";
  let migrations = 0;
  let markerRows = 0;
  let archiveBytes = 0;
  let restored = false;

  try {
    await client.connect();
    connected = true;
    phase = "create temporary schema";
    await client.query(`CREATE SCHEMA "${schema}"`);
    phase = "deploy migrations";
    const schemaUrl = new URL(databaseUrl);
    schemaUrl.searchParams.set("schema", schema);
    const migrationEnvironment = {
      ...process.env,
      DIRECT_URL: schemaUrl.toString(),
      DATABASE_URL: schemaUrl.toString()
    };
    run("pnpm", ["exec", "prisma", "migrate", "deploy"], migrationEnvironment, "Migration deployment");
    phase = "insert verification marker";
    await client.query(
      `INSERT INTO "${schema}"."Child" ("id", "externalChildId", "ageMonths", "processingAllowed", "isActive", "createdAt", "updatedAt") VALUES ($1, $2, 24, true, true, NOW(), NOW())`,
      [markerId, `Recovery ${startedAt}`]
    );

    const postgresCommandEnvironment = postgresEnvironment(databaseUrl);
    phase = "create logical backup";
    run(dumpBinary, [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      `--schema=${schema}`,
      "--file",
      archive
    ], postgresCommandEnvironment, "Logical backup");
    archiveBytes = (await stat(archive)).size;
    if (archiveBytes <= 0) throw new Error("Logical backup was empty.");

    phase = "remove source schema";
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    phase = "restore logical backup";
    run(restoreBinary, [
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      postgresCommandEnvironment.PGDATABASE ?? "",
      archive
    ], postgresCommandEnvironment, "Logical restore");

    phase = "verify restored migrations";
    const migrationResult = await client.query(
      `SELECT count(*)::int AS count FROM "${schema}"."_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`
    );
    phase = "verify restored marker";
    const markerResult = await client.query(
      `SELECT count(*)::int AS count FROM "${schema}"."Child" WHERE "id" = $1`,
      [markerId]
    );
    migrations = migrationResult.rows[0].count;
    markerRows = markerResult.rows[0].count;
    restored = migrations > 0 && markerRows === 1;
    if (!restored) throw new Error("Restored data verification failed.");
  } catch (error) {
    console.error(`The isolated database recovery drill failed during: ${phase}. No connection details were printed.`);
    if (phase !== "connect to database") {
      console.error(error instanceof Error ? error.message : "Unknown recovery error.");
    }
    process.exitCode = 1;
  } finally {
    if (connected) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
      await client.end().catch(() => undefined);
    }
    await rm(directory, { recursive: true, force: true });
  }

  if (restored) {
    console.log(JSON.stringify({
      status: "pass",
      migrations,
      markerRows,
      archiveBytes,
      durationMs: Date.now() - startedAt,
      temporarySchemaRemoved: true,
      temporaryArchiveRemoved: true
    }, null, 2));
  }
}

void main();
