import { databaseClient } from "./prisma";

export interface SharedRateLimitStore {
  increment(input: {
    readonly scope: string;
    readonly identityHash: string;
    readonly now: Date;
    readonly resetAt: Date;
  }): Promise<number>;
}

let nextCleanupAt = 0;

export const postgresRateLimitStore: SharedRateLimitStore = {
  async increment({ scope, identityHash, now, resetAt }) {
    const database = databaseClient();
    const rows = await database.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("scope", "identityHash", "count", "resetAt", "updatedAt")
      VALUES (${scope}, ${identityHash}, 1, ${resetAt}, ${now})
      ON CONFLICT ("scope", "identityHash") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count"
    `;
    if (!rows[0]) throw new Error("The shared rate-limit counter returned no result.");

    if (now.getTime() >= nextCleanupAt) {
      nextCleanupAt = now.getTime() + 60 * 60 * 1_000;
      await database.rateLimitBucket.deleteMany({
        where: { resetAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1_000) } }
      });
    }
    return rows[0].count;
  }
};

export async function incrementSharedRateLimit(
  scope: string,
  identityHash: string,
  now: number,
  windowMs: number,
  store: SharedRateLimitStore = postgresRateLimitStore
): Promise<number> {
  return store.increment({
    scope,
    identityHash,
    now: new Date(now),
    resetAt: new Date(now + windowMs)
  });
}
