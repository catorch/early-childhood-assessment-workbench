import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalDatabase = globalThis as typeof globalThis & {
  helpReviewPrisma?: PrismaClient;
};

function createDatabaseClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when the Neon state adapter is selected.");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

/** Reuses the Prisma client across Next.js reloads and warm serverless invocations. */
export function databaseClient(): PrismaClient {
  return (globalDatabase.helpReviewPrisma ??= createDatabaseClient());
}
