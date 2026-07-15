import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalDatabase = globalThis as typeof globalThis & {
  helpReviewPrisma?: PrismaClient;
};

function createDatabaseClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when a PostgreSQL state adapter is selected.");
  }
  const databaseAdapter = process.env.HELP_REVIEW_DATABASE_ADAPTER ??
    (process.env.HELP_REVIEW_STATE_ADAPTER === "pg" ? "pg" : "neon");
  const adapter = databaseAdapter === "pg"
    ? new PrismaPg({ connectionString, connectionTimeoutMillis: 15_000 })
    : new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

/** Reuses the Prisma client across Next.js reloads and warm serverless invocations. */
export function databaseClient(): PrismaClient {
  return (globalDatabase.helpReviewPrisma ??= createDatabaseClient());
}
