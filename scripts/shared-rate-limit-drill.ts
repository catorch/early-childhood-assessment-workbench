import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import { parseArgs } from "node:util";

import { databaseClient } from "../lib/help-review/prisma";
import { incrementSharedRateLimit } from "../lib/help-review/shared-rate-limit";

setDefaultResultOrder("ipv4first");

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  const { values } = parseArgs({
    args,
    options: {
      "confirm-sanitized-database": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false }
    },
    strict: true
  });
  if (values.help) {
    console.log("Usage: pnpm db:rate-limit-drill -- --confirm-sanitized-database");
    console.log("Exercises and removes one opaque shared rate-limit bucket.");
    return;
  }
  if (!values["confirm-sanitized-database"]) {
    console.error("Pass --confirm-sanitized-database to run the shared counter drill.");
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exitCode = 1;
    return;
  }

  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
    process.env.HELP_REVIEW_DATABASE_ADAPTER = "pg";
  }

  const database = databaseClient();
  const scope = `verification-${randomUUID()}`;
  const identityHash = createHash("sha256").update(randomUUID()).digest("hex");
  const startedAt = Date.now();
  const requests = 12;
  let result: Record<string, unknown> | undefined;
  let operationFailed = false;
  try {
    const counts = await Promise.all(Array.from({ length: requests }, () =>
      incrementSharedRateLimit(scope, identityHash, startedAt, 60_000)
    ));
    const ordered = [...counts].sort((left, right) => left - right);
    const expected = Array.from({ length: requests }, (_, index) => index + 1);
    if (ordered.some((count, index) => count !== expected[index])) {
      throw new Error("The shared counter did not serialize concurrent increments.");
    }
    result = {
      status: "pass",
      concurrentIncrements: requests,
      minimumCount: ordered[0],
      maximumCount: ordered.at(-1),
      durationMs: Date.now() - startedAt,
      temporaryBucketRemoved: true
    };
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      await database.rateLimitBucket.deleteMany({ where: { scope, identityHash } });
    } catch (cleanupError) {
      if (!operationFailed) throw cleanupError;
    } finally {
      await database.$disconnect().catch(() => undefined);
    }
  }
  if (result) console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  const name = error instanceof Error
    ? error.name
    : error && typeof error === "object" && "constructor" in error
      ? String((error as { constructor?: { name?: string } }).constructor?.name ?? "UnknownError")
      : typeof error;
  const keys = error && typeof error === "object" ? Object.keys(error).slice(0, 6).join(",") : "none";
  const metaKeys = error && typeof error === "object" && "meta" in error && error.meta && typeof error.meta === "object"
    ? Object.keys(error.meta).slice(0, 6).join(",")
    : "none";
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? `/${error.code}`
    : "";
  console.error(`The shared rate-limit drill failed (${name}${code}; fields: ${keys}; meta: ${metaKeys}). No connection details were printed.`);
  process.exitCode = 1;
});
