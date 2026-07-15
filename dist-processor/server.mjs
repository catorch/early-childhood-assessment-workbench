var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// lib/help-review/gcs-storage.ts
import { createHash } from "node:crypto";
import { Storage } from "@google-cloud/storage";
function googleCloudStorage() {
  return sharedStorage ??= new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
  });
}
function configuredGcsBucket(environment = process.env) {
  const bucket = environment.GCS_VIDEO_BUCKET?.trim();
  if (!bucket) throw new Error("GCS_VIDEO_BUCKET is required for Google Cloud video storage.");
  return bucket;
}
function generationNumber(generation) {
  if (!generation) return void 0;
  const parsed = Number(generation);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("The stored Google Cloud object generation is invalid.");
  }
  return parsed;
}
function objectFile(bucket, objectName, generation) {
  return googleCloudStorage().bucket(bucket).file(objectName, {
    generation: generationNumber(generation)
  });
}
function customMetadata(metadata) {
  const source = metadata.metadata;
  if (!source || typeof source !== "object") return {};
  return Object.fromEntries(
    Object.entries(source).filter((entry) => typeof entry[1] === "string")
  );
}
async function inspectGcsObject(objectName, expectedGeneration, bucket = configuredGcsBucket()) {
  const file = objectFile(bucket, objectName, expectedGeneration);
  const [metadata] = await file.getMetadata();
  const generation = String(metadata.generation ?? "");
  if (!generation || expectedGeneration && generation !== expectedGeneration) {
    throw new Error("The completed Google Cloud upload generation is invalid.");
  }
  const byteSize = Number(metadata.size);
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
    throw new Error("The completed Google Cloud upload size is invalid.");
  }
  const [firstBytes] = await file.download({ start: 0, end: Math.min(byteSize - 1, 63) });
  return {
    bucket,
    objectName,
    generation,
    contentType: metadata.contentType ?? "application/octet-stream",
    byteSize,
    crc32c: metadata.crc32c ?? "",
    metadata: customMetadata(metadata),
    firstBytes
  };
}
async function sha256GcsObject(video) {
  const bucket = video.storageBucket ?? configuredGcsBucket();
  const [bytes] = await objectFile(bucket, video.storageKey, video.storageGeneration).download();
  return createHash("sha256").update(bytes).digest("hex");
}
var sharedStorage;
var init_gcs_storage = __esm({
  "lib/help-review/gcs-storage.ts"() {
    "use strict";
  }
});

// lib/help-review/domain.ts
import { z } from "zod";
var PRIMARY_CREDITS, PrimaryCreditSchema, DECISION_ORIGINS, DecisionOriginSchema, ASSESSMENT_STATUSES, AssessmentStatusSchema, ReviewDecisionMutationSchema, EvidenceSchema, SkillSuggestionSchema;
var init_domain = __esm({
  "lib/help-review/domain.ts"() {
    "use strict";
    PRIMARY_CREDITS = ["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"];
    PrimaryCreditSchema = z.enum(PRIMARY_CREDITS);
    DECISION_ORIGINS = ["ACCEPTED", "OVERRIDDEN", "SCORED_INDEPENDENTLY", "DISMISSED"];
    DecisionOriginSchema = z.enum(DECISION_ORIGINS);
    ASSESSMENT_STATUSES = [
      "DRAFT",
      "UPLOADING",
      "PROCESSING",
      "READY_FOR_REVIEW",
      "IN_REVIEW",
      "FINALIZED",
      "FAILED"
    ];
    AssessmentStatusSchema = z.enum(ASSESSMENT_STATUSES);
    ReviewDecisionMutationSchema = z.object({
      expectedRevision: z.number().int().nonnegative(),
      finalCredit: PrimaryCreditSchema.nullable(),
      dismissed: z.boolean(),
      note: z.string().trim().max(1e3).nullable()
    }).strict().superRefine((value, context) => {
      const dismissedWithCredit = value.dismissed && value.finalCredit !== null;
      const includedWithoutCredit = !value.dismissed && value.finalCredit === null;
      if (dismissedWithCredit || includedWithoutCredit) {
        context.addIssue({
          code: "custom",
          path: ["finalCredit"],
          message: "Dismissed suggestions have no credit; included suggestions require one."
        });
      }
    });
    EvidenceSchema = z.object({
      timestampSeconds: z.number().int().nonnegative(),
      endTimestampSeconds: z.number().int().nonnegative().optional(),
      explanation: z.string().trim().min(1).max(2e3)
    }).strict().superRefine((value, context) => {
      if (value.endTimestampSeconds !== void 0 && value.endTimestampSeconds < value.timestampSeconds) {
        context.addIssue({
          code: "custom",
          path: ["endTimestampSeconds"],
          message: "Evidence end time cannot be earlier than its start time."
        });
      }
    });
    SkillSuggestionSchema = z.object({
      id: z.string().min(1),
      sourceSkillId: z.string().min(1),
      skillCode: z.string().min(1),
      skillName: z.string().min(1),
      domain: z.string().min(1),
      strand: z.string().min(1).nullable(),
      draftCredit: PrimaryCreditSchema.nullable(),
      confidence: z.number().min(0).max(1).nullable(),
      uncertaintyReason: z.string().min(1).nullable(),
      evidence: z.array(EvidenceSchema).min(1),
      sourceOrder: z.number().int().nonnegative()
    }).strict().superRefine((value, context) => {
      if (value.draftCredit === null && value.uncertaintyReason === null) {
        context.addIssue({
          code: "custom",
          path: ["uncertaintyReason"],
          message: "An unscored suggestion requires an uncertainty reason."
        });
      }
    });
  }
});

// lib/help-review/fixtures.ts
function createSanitizedPilotState() {
  return {
    fixtureVersion: 1,
    users: [
      {
        id: "user-educator-1",
        externalSubject: "sandbox:educator.alex",
        email: "alex.educator@example.test",
        displayName: "Alex Morgan",
        role: "EDUCATOR",
        isActive: true
      },
      {
        id: "user-educator-2",
        externalSubject: "sandbox:educator.jordan",
        email: "jordan.educator@example.test",
        displayName: "Jordan Lee",
        role: "EDUCATOR",
        isActive: true
      },
      {
        id: "user-admin-1",
        externalSubject: "sandbox:admin.casey",
        email: "casey.admin@example.test",
        displayName: "Casey Rivera",
        role: "ADMIN",
        isActive: true
      }
    ],
    children: [
      {
        id: "child-1001",
        externalChildId: "Child 1001",
        ageMonths: 19,
        contextLabel: "IFSP: No",
        processingAllowed: true,
        isActive: true
      },
      {
        id: "child-1024",
        externalChildId: "Child 1024",
        ageMonths: 31,
        contextLabel: null,
        processingAllowed: true,
        isActive: true
      },
      {
        id: "child-1048",
        externalChildId: "Child 1048",
        ageMonths: 44,
        contextLabel: "Processing permission pending",
        processingAllowed: false,
        isActive: true
      }
    ],
    assignments: [
      {
        id: "assignment-1",
        educatorId: "user-educator-1",
        childId: "child-1001",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "assignment-2",
        educatorId: "user-educator-1",
        childId: "child-1024",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "assignment-3",
        educatorId: "user-educator-1",
        childId: "child-1048",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      }
    ],
    assessments: [],
    access: [
      {
        id: "access-educator-1",
        exactEmail: "alex.educator@example.test",
        userId: "user-educator-1",
        role: "EDUCATOR",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "access-educator-2",
        exactEmail: "jordan.educator@example.test",
        userId: "user-educator-2",
        role: "EDUCATOR",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      },
      {
        id: "access-admin-1",
        exactEmail: "casey.admin@example.test",
        userId: "user-admin-1",
        role: "ADMIN",
        active: true,
        updatedAt: NOW,
        updatedById: "user-admin-1"
      }
    ],
    supportEvents: [],
    videoAccessGrants: []
  };
}
var NOW;
var init_fixtures = __esm({
  "lib/help-review/fixtures.ts"() {
    "use strict";
    NOW = "2026-07-13T14:00:00.000Z";
  }
});

// lib/help-review/prisma.ts
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required when a PostgreSQL state adapter is selected.");
  }
  const databaseAdapter = process.env.HELP_REVIEW_DATABASE_ADAPTER ?? (process.env.HELP_REVIEW_STATE_ADAPTER === "pg" ? "pg" : "neon");
  const adapter = databaseAdapter === "pg" ? new PrismaPg({ connectionString }) : new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}
function databaseClient() {
  return globalDatabase.helpReviewPrisma ??= createDatabaseClient();
}
var globalDatabase;
var init_prisma = __esm({
  "lib/help-review/prisma.ts"() {
    "use strict";
    globalDatabase = globalThis;
  }
});

// lib/help-review/neon-store.ts
var neon_store_exports = {};
__export(neon_store_exports, {
  readNeonPilotState: () => readNeonPilotState,
  updateNeonPilotState: () => updateNeonPilotState
});
import { Prisma } from "@prisma/client";
function asExecutor(client) {
  return client;
}
function date(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid pilot timestamp: ${value}`);
  return parsed;
}
function observationDate(value) {
  return value.toISOString().slice(0, 10);
}
function contextLabel(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const label = value["label"];
  return typeof label === "string" ? label : null;
}
function assessmentContextSnapshot(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return void 0;
  const snapshot = value;
  const ageMonthsAtObservation = snapshot.ageMonthsAtObservation;
  const supportContext = snapshot.supportContext;
  const context = snapshot.contextLabel;
  const processingAllowedAtCreation = snapshot.processingAllowedAtCreation;
  const capturedAt = snapshot.capturedAt;
  const source = snapshot.source;
  if (typeof ageMonthsAtObservation !== "number" || !["NONE_REPORTED", "IFSP", "DISABILITY", "IFSP_AND_DISABILITY", "UNKNOWN"].includes(String(supportContext)) || !(typeof context === "string" || context === null) || typeof processingAllowedAtCreation !== "boolean" || typeof capturedAt !== "string" || !["SANITIZED_ADMIN", "ROSTER_ADAPTER"].includes(String(source))) return void 0;
  return {
    ageMonthsAtObservation,
    supportContext,
    contextLabel: context,
    processingAllowedAtCreation,
    capturedAt,
    source
  };
}
async function lockState(transaction) {
  await transaction.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(${DATABASE_LOCK_KEY})`;
}
async function loadState(database) {
  const users = await database.user.findMany({ orderBy: { createdAt: "asc" } });
  const children = await database.child.findMany({ orderBy: { createdAt: "asc" } });
  const assignments = await database.childAssignment.findMany({ orderBy: { createdAt: "asc" } });
  const access = await database.accessProvision.findMany({ orderBy: { createdAt: "asc" } });
  const assessments = await database.assessment.findMany({
    include: {
      videoAssets: { orderBy: { updatedAt: "desc" } },
      processingRuns: {
        orderBy: { attempt: "asc" },
        include: {
          suggestions: {
            orderBy: { sourceOrder: "asc" },
            include: { decision: true }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  const supportEvents = await database.supportEvent.findMany({ orderBy: { occurredAt: "asc" } });
  const videoAccessGrants = await database.videoAccessGrantRecord.findMany({ orderBy: { issuedAt: "asc" } });
  const userBySubject = new Map(users.map((user) => [user.externalSubject, user]));
  const userByEmail = new Map(
    users.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user])
  );
  return {
    fixtureVersion: 1,
    users: users.map((user) => ({
      id: user.id,
      externalSubject: user.externalSubject,
      email: user.email ?? `${user.id}@unavailable.invalid`,
      displayName: user.displayName ?? "Unavailable staff member",
      role: user.role,
      isActive: user.isActive
    })),
    children: children.map((child) => ({
      id: child.id,
      externalChildId: child.externalChildId,
      ageMonths: child.ageMonths,
      contextLabel: contextLabel(child.approvedContext),
      processingAllowed: child.processingAllowed === true,
      isActive: child.isActive
    })),
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      educatorId: assignment.educatorId,
      childId: assignment.childId,
      active: assignment.revokedAt === null && (assignment.endsAt === null || assignment.endsAt.getTime() > Date.now()),
      updatedAt: assignment.updatedAt.toISOString(),
      updatedById: assignment.createdById
    })),
    assessments: assessments.map((assessment) => {
      const availableVideo = assessment.videoAssets.find(
        (video) => video.status === "AVAILABLE" && video.deletedAt === null
      );
      const resultRun = [...assessment.processingRuns].reverse().find((run) => run.suggestions.length > 0);
      const suggestions = (resultRun?.suggestions ?? []).map(
        (suggestion) => SkillSuggestionSchema.parse({
          id: suggestion.id,
          sourceSkillId: suggestion.sourceSkillId,
          skillCode: suggestion.skillCode,
          skillName: suggestion.skillName,
          domain: suggestion.domain,
          strand: suggestion.strand,
          draftCredit: suggestion.draftCredit,
          confidence: suggestion.confidence,
          uncertaintyReason: suggestion.uncertaintyReason,
          evidence: suggestion.evidence,
          sourceOrder: suggestion.sourceOrder
        })
      );
      const decisions = (resultRun?.suggestions ?? []).flatMap((suggestion) => {
        if (!suggestion.decision) return [];
        return [{
          suggestionId: suggestion.decision.suggestionId,
          educatorId: suggestion.decision.educatorId,
          origin: suggestion.decision.origin,
          finalCredit: suggestion.decision.finalCredit,
          dismissed: suggestion.decision.dismissed,
          note: suggestion.decision.note,
          revision: suggestion.decision.revision,
          decidedAt: suggestion.decision.decidedAt.toISOString()
        }];
      });
      return {
        id: assessment.id,
        childId: assessment.childId,
        educatorId: assessment.educatorId,
        observationDate: observationDate(assessment.observationDate),
        contextSnapshot: assessmentContextSnapshot(assessment.contextSnapshot),
        contentCatalogVersion: assessment.contentCatalogVersion,
        scoringContractVersion: assessment.scoringContractVersion,
        status: assessment.status,
        video: availableVideo ? {
          id: availableVideo.id,
          storageProvider: availableVideo.storageProvider,
          storageKey: availableVideo.storageKey,
          storageBucket: availableVideo.storageBucket,
          storageGeneration: availableVideo.storageGeneration,
          originalFilename: availableVideo.originalFilename ?? "observation-video",
          contentType: availableVideo.contentType ?? "application/octet-stream",
          byteSize: Number(availableVideo.byteSize ?? 0n),
          durationSeconds: availableVideo.durationSeconds,
          checksumSha256: availableVideo.checksumSha256,
          checksumCrc32c: availableVideo.checksumCrc32c,
          uploadedAt: availableVideo.createdAt.toISOString(),
          uploadedById: availableVideo.uploadedById
        } : null,
        runs: assessment.processingRuns.map((run) => {
          const requestedAt = (run.submittedAt ?? run.createdAt).toISOString();
          return {
            id: run.id,
            attempt: run.attempt,
            status: run.status,
            externalJobId: run.externalJobId ?? `sandbox-job-${run.id}`,
            requestedAt,
            requestedById: run.requestedById,
            startedAt: run.startedAt?.toISOString() ?? null,
            readyAt: null,
            completedAt: run.completedAt?.toISOString() ?? null,
            safeErrorCode: run.safeErrorCode,
            scoringConfigurationReference: run.scoringConfigurationReference,
            retryOfRunId: run.retryOfRunId,
            triggerEventId: run.triggerEventId,
            triggerObjectGeneration: run.triggerObjectGeneration,
            deliveryCount: run.deliveryCount,
            lastDispatchedAt: run.lastDispatchedAt?.toISOString() ?? null
          };
        }),
        suggestions,
        decisions,
        finalizedAt: assessment.finalizedAt?.toISOString() ?? null,
        finalizedById: assessment.finalizedById,
        createdAt: assessment.createdAt.toISOString(),
        updatedAt: assessment.updatedAt.toISOString(),
        revision: assessment.revision,
        clientRequestId: assessment.clientRequestId ?? void 0,
        finalizationKey: assessment.finalizationKey
      };
    }),
    access: access.flatMap((provision) => {
      const user = (provision.externalSubject ? userBySubject.get(provision.externalSubject) : void 0) ?? (provision.exactEmail ? userByEmail.get(provision.exactEmail.toLowerCase()) : void 0);
      if (!user) return [];
      return [{
        id: provision.id,
        exactEmail: provision.exactEmail ?? user.email ?? `${user.id}@unavailable.invalid`,
        userId: user.id,
        role: provision.intendedRole,
        active: provision.deactivatedAt === null,
        updatedAt: provision.updatedAt.toISOString(),
        updatedById: provision.provisionedById
      }];
    }),
    supportEvents: supportEvents.map((event) => ({
      id: event.id,
      type: event.type,
      actorId: event.actorId,
      occurredAt: event.occurredAt.toISOString(),
      assessmentId: event.assessmentId ?? void 0,
      subjectId: event.subjectId ?? void 0,
      referenceId: event.referenceId ?? void 0
    })),
    videoAccessGrants: videoAccessGrants.map((grant) => ({
      id: grant.id,
      assessmentId: grant.assessmentId,
      videoAssetId: grant.videoAssetId,
      viewerId: grant.viewerId,
      purpose: "EDUCATOR_REVIEW",
      issuedAt: grant.issuedAt.toISOString(),
      expiresAt: grant.expiresAt.toISOString()
    }))
  };
}
async function persistState(database, state) {
  for (const user of state.users) {
    await database.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        externalSubject: user.externalSubject,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive
      },
      update: {
        externalSubject: user.externalSubject,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive
      }
    });
  }
  for (const child of state.children) {
    const approvedContext = child.contextLabel ? { label: child.contextLabel } : Prisma.JsonNull;
    await database.child.upsert({
      where: { id: child.id },
      create: {
        id: child.id,
        externalChildId: child.externalChildId,
        ageMonths: child.ageMonths,
        approvedContext,
        processingAllowed: child.processingAllowed,
        isActive: child.isActive
      },
      update: {
        externalChildId: child.externalChildId,
        ageMonths: child.ageMonths,
        approvedContext,
        processingAllowed: child.processingAllowed,
        isActive: child.isActive
      }
    });
  }
  for (const provision of state.access) {
    const user = state.users.find((candidate) => candidate.id === provision.userId);
    if (!user) throw new Error(`Access provision ${provision.id} references an unknown user.`);
    const changedAt = date(provision.updatedAt);
    await database.accessProvision.upsert({
      where: { id: provision.id },
      create: {
        id: provision.id,
        externalSubject: user.externalSubject,
        exactEmail: provision.exactEmail,
        intendedRole: provision.role,
        provisionedById: provision.updatedById,
        activatedAt: provision.active ? changedAt : null,
        deactivatedAt: provision.active ? null : changedAt,
        updatedAt: changedAt
      },
      update: {
        externalSubject: user.externalSubject,
        exactEmail: provision.exactEmail,
        intendedRole: provision.role,
        provisionedById: provision.updatedById,
        activatedAt: provision.active ? changedAt : null,
        deactivatedAt: provision.active ? null : changedAt,
        updatedAt: changedAt
      }
    });
  }
  for (const assignment of state.assignments) {
    const changedAt = date(assignment.updatedAt);
    await database.childAssignment.upsert({
      where: { id: assignment.id },
      create: {
        id: assignment.id,
        educatorId: assignment.educatorId,
        childId: assignment.childId,
        startsAt: changedAt,
        revokedAt: assignment.active ? null : changedAt,
        createdById: assignment.updatedById,
        updatedAt: changedAt
      },
      update: {
        revokedAt: assignment.active ? null : changedAt,
        endsAt: null,
        createdById: assignment.updatedById,
        updatedAt: changedAt
      }
    });
  }
  for (const assessment of state.assessments) {
    const contextSnapshot = assessment.contextSnapshot ? assessment.contextSnapshot : Prisma.JsonNull;
    await database.assessment.upsert({
      where: { id: assessment.id },
      create: {
        id: assessment.id,
        childId: assessment.childId,
        educatorId: assessment.educatorId,
        observationDate: date(`${assessment.observationDate}T00:00:00.000Z`),
        contextSnapshot,
        contentCatalogVersion: assessment.contentCatalogVersion ?? "help-2-provisional-2026-07",
        scoringContractVersion: assessment.scoringContractVersion ?? "help-scoring-v0",
        status: assessment.status,
        finalizedById: assessment.finalizedById,
        finalizedAt: assessment.finalizedAt ? date(assessment.finalizedAt) : null,
        revision: assessment.revision ?? 0,
        clientRequestId: assessment.clientRequestId,
        finalizationKey: assessment.finalizationKey,
        createdAt: date(assessment.createdAt),
        updatedAt: date(assessment.updatedAt)
      },
      update: {
        observationDate: date(`${assessment.observationDate}T00:00:00.000Z`),
        contextSnapshot,
        contentCatalogVersion: assessment.contentCatalogVersion ?? "help-2-provisional-2026-07",
        scoringContractVersion: assessment.scoringContractVersion ?? "help-scoring-v0",
        status: assessment.status,
        finalizedById: assessment.finalizedById,
        finalizedAt: assessment.finalizedAt ? date(assessment.finalizedAt) : null,
        revision: assessment.revision ?? 0,
        clientRequestId: assessment.clientRequestId,
        finalizationKey: assessment.finalizationKey,
        updatedAt: date(assessment.updatedAt)
      }
    });
    const activeVideoId = assessment.video?.id;
    const storedVideos = await database.videoAsset.findMany({
      where: { assessmentId: assessment.id },
      select: { id: true, status: true }
    });
    for (const storedVideo of storedVideos) {
      if (storedVideo.id === activeVideoId || storedVideo.status === "DELETED") continue;
      await database.videoAsset.update({
        where: { id: storedVideo.id },
        data: { status: "DELETED", deletedAt: /* @__PURE__ */ new Date() }
      });
    }
    if (assessment.video) {
      await database.videoAsset.upsert({
        where: { id: assessment.video.id },
        create: {
          id: assessment.video.id,
          assessmentId: assessment.id,
          status: "AVAILABLE",
          storageProvider: assessment.video.storageProvider ?? "local",
          storageKey: assessment.video.storageKey,
          storageBucket: assessment.video.storageBucket,
          storageGeneration: assessment.video.storageGeneration,
          originalFilename: assessment.video.originalFilename,
          contentType: assessment.video.contentType,
          byteSize: BigInt(assessment.video.byteSize),
          durationSeconds: assessment.video.durationSeconds,
          checksumSha256: assessment.video.checksumSha256,
          checksumCrc32c: assessment.video.checksumCrc32c,
          uploadedById: assessment.video.uploadedById,
          createdAt: date(assessment.video.uploadedAt)
        },
        update: {
          status: "AVAILABLE",
          storageProvider: assessment.video.storageProvider ?? "local",
          storageKey: assessment.video.storageKey,
          storageBucket: assessment.video.storageBucket,
          storageGeneration: assessment.video.storageGeneration,
          originalFilename: assessment.video.originalFilename,
          contentType: assessment.video.contentType,
          byteSize: BigInt(assessment.video.byteSize),
          durationSeconds: assessment.video.durationSeconds,
          checksumSha256: assessment.video.checksumSha256,
          checksumCrc32c: assessment.video.checksumCrc32c,
          uploadedById: assessment.video.uploadedById,
          deletedAt: null
        }
      });
    }
    const storedRuns = await database.processingRun.findMany({
      where: { assessmentId: assessment.id },
      select: { id: true }
    });
    const stateRunIds = new Set(assessment.runs.map((run) => run.id));
    const staleRunIds = storedRuns.map((run) => run.id).filter((id) => !stateRunIds.has(id));
    if (staleRunIds.length > 0) {
      await database.reviewDecision.deleteMany({
        where: { suggestion: { processingRunId: { in: staleRunIds } } }
      });
      await database.skillSuggestion.deleteMany({ where: { processingRunId: { in: staleRunIds } } });
      await database.processingRun.deleteMany({ where: { id: { in: staleRunIds } } });
    }
    for (const run of assessment.runs) {
      const requestedAt = date(run.requestedAt);
      await database.processingRun.upsert({
        where: { id: run.id },
        create: {
          id: run.id,
          assessmentId: assessment.id,
          attempt: run.attempt,
          status: run.status,
          externalJobId: run.externalJobId,
          scoringConfigurationReference: run.scoringConfigurationReference,
          safeErrorCode: run.safeErrorCode,
          retryOfRunId: run.retryOfRunId,
          requestedById: run.requestedById,
          submittedAt: requestedAt,
          startedAt: run.startedAt ? date(run.startedAt) : null,
          completedAt: run.completedAt ? date(run.completedAt) : null,
          triggerEventId: run.triggerEventId,
          triggerObjectGeneration: run.triggerObjectGeneration,
          deliveryCount: run.deliveryCount ?? 0,
          lastDispatchedAt: run.lastDispatchedAt ? date(run.lastDispatchedAt) : null
        },
        update: {
          attempt: run.attempt,
          status: run.status,
          externalJobId: run.externalJobId,
          scoringConfigurationReference: run.scoringConfigurationReference,
          safeErrorCode: run.safeErrorCode,
          retryOfRunId: run.retryOfRunId,
          requestedById: run.requestedById,
          submittedAt: requestedAt,
          startedAt: run.startedAt ? date(run.startedAt) : null,
          completedAt: run.completedAt ? date(run.completedAt) : null,
          triggerEventId: run.triggerEventId,
          triggerObjectGeneration: run.triggerObjectGeneration,
          deliveryCount: run.deliveryCount ?? 0,
          lastDispatchedAt: run.lastDispatchedAt ? date(run.lastDispatchedAt) : null
        }
      });
    }
    const storedSuggestions = await database.skillSuggestion.findMany({
      where: { processingRun: { assessmentId: assessment.id } },
      select: { id: true }
    });
    const stateSuggestionIds = new Set(assessment.suggestions.map((suggestion) => suggestion.id));
    const staleSuggestionIds = storedSuggestions.map((suggestion) => suggestion.id).filter((id) => !stateSuggestionIds.has(id));
    if (staleSuggestionIds.length > 0) {
      await database.reviewDecision.deleteMany({ where: { suggestionId: { in: staleSuggestionIds } } });
      await database.skillSuggestion.deleteMany({ where: { id: { in: staleSuggestionIds } } });
    }
    const resultRun = [...assessment.runs].reverse().find((run) => run.status === "COMPLETED") ?? assessment.runs.at(-1);
    if (assessment.suggestions.length > 0 && !resultRun) {
      throw new Error(`Assessment ${assessment.id} has suggestions without a processing run.`);
    }
    for (const suggestion of assessment.suggestions) {
      await database.skillSuggestion.upsert({
        where: { id: suggestion.id },
        create: {
          id: suggestion.id,
          processingRunId: resultRun.id,
          sourceSkillId: suggestion.sourceSkillId,
          skillCode: suggestion.skillCode,
          skillName: suggestion.skillName,
          domain: suggestion.domain,
          strand: suggestion.strand,
          draftCredit: suggestion.draftCredit,
          confidence: suggestion.confidence,
          uncertaintyReason: suggestion.uncertaintyReason,
          evidence: suggestion.evidence,
          sourceOrder: suggestion.sourceOrder
        },
        update: {
          processingRunId: resultRun.id,
          sourceSkillId: suggestion.sourceSkillId,
          skillCode: suggestion.skillCode,
          skillName: suggestion.skillName,
          domain: suggestion.domain,
          strand: suggestion.strand,
          draftCredit: suggestion.draftCredit,
          confidence: suggestion.confidence,
          uncertaintyReason: suggestion.uncertaintyReason,
          evidence: suggestion.evidence,
          sourceOrder: suggestion.sourceOrder
        }
      });
    }
    const stateDecisionIds = new Set(assessment.decisions.map((decision) => decision.suggestionId));
    const storedDecisions = await database.reviewDecision.findMany({
      where: { suggestion: { processingRun: { assessmentId: assessment.id } } },
      select: { suggestionId: true }
    });
    const staleDecisionIds = storedDecisions.map((decision) => decision.suggestionId).filter((id) => !stateDecisionIds.has(id));
    if (staleDecisionIds.length > 0) {
      await database.reviewDecision.deleteMany({ where: { suggestionId: { in: staleDecisionIds } } });
    }
    for (const decision of assessment.decisions) {
      await database.reviewDecision.upsert({
        where: { suggestionId: decision.suggestionId },
        create: {
          id: `decision-${decision.suggestionId}`,
          suggestionId: decision.suggestionId,
          educatorId: decision.educatorId,
          origin: decision.origin,
          finalCredit: decision.finalCredit,
          dismissed: decision.dismissed,
          note: decision.note,
          revision: decision.revision,
          decidedAt: date(decision.decidedAt)
        },
        update: {
          educatorId: decision.educatorId,
          origin: decision.origin,
          finalCredit: decision.finalCredit,
          dismissed: decision.dismissed,
          note: decision.note,
          revision: decision.revision,
          decidedAt: date(decision.decidedAt)
        }
      });
    }
  }
  for (const event of state.supportEvents ?? []) {
    await database.supportEvent.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        type: event.type,
        actorId: event.actorId,
        occurredAt: date(event.occurredAt),
        assessmentId: event.assessmentId,
        subjectId: event.subjectId,
        referenceId: event.referenceId
      },
      update: {
        type: event.type,
        actorId: event.actorId,
        occurredAt: date(event.occurredAt),
        assessmentId: event.assessmentId,
        subjectId: event.subjectId,
        referenceId: event.referenceId
      }
    });
  }
  for (const grant of state.videoAccessGrants ?? []) {
    await database.videoAccessGrantRecord.upsert({
      where: { id: grant.id },
      create: {
        id: grant.id,
        assessmentId: grant.assessmentId,
        videoAssetId: grant.videoAssetId,
        viewerId: grant.viewerId,
        purpose: grant.purpose,
        issuedAt: date(grant.issuedAt),
        expiresAt: date(grant.expiresAt)
      },
      update: {
        purpose: grant.purpose,
        expiresAt: date(grant.expiresAt)
      }
    });
  }
}
async function seedDatabase() {
  const prisma = databaseClient();
  await prisma.$transaction(async (transaction) => {
    await lockState(transaction);
    const fixtureExists = await transaction.user.findUnique({
      where: { id: "user-educator-1" },
      select: { id: true }
    });
    if (fixtureExists) return;
    const seedApproved = process.env.HELP_REVIEW_SEED_SANITIZED_DATA === "true" || process.env.NODE_ENV !== "production";
    if (!seedApproved) {
      throw new Error(
        "The PostgreSQL database has no sanitized pilot seed. Set HELP_REVIEW_SEED_SANITIZED_DATA=true only for an approved demo."
      );
    }
    await persistState(transaction, createSanitizedPilotState());
  }, { timeout: 3e4 });
}
async function ensureSeed() {
  seedPromise ??= seedDatabase().catch((error) => {
    seedPromise = void 0;
    throw error;
  });
  await seedPromise;
}
async function readNeonPilotState() {
  await ensureSeed();
  return loadState(asExecutor(databaseClient()));
}
async function updateNeonPilotState(mutation) {
  await ensureSeed();
  return databaseClient().$transaction(async (transaction) => {
    await lockState(transaction);
    const state = await loadState(transaction);
    const result = await mutation(state);
    await persistState(transaction, state);
    return result;
  }, { timeout: 3e4 });
}
var DATABASE_LOCK_KEY, seedPromise;
var init_neon_store = __esm({
  "lib/help-review/neon-store.ts"() {
    "use strict";
    init_domain();
    init_fixtures();
    init_prisma();
    DATABASE_LOCK_KEY = 7210042026;
  }
});

// processor/server.ts
init_gcs_storage();
import "dotenv/config";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";

// lib/help-review/processing-coordinator.ts
import { createHash as createHash3 } from "node:crypto";

// lib/help-review/scoring-contract.ts
init_domain();
import { z as z2 } from "zod";
var SCORING_CONTRACT_VERSION = "help-scoring-v0";
var HELP_CATALOG_VERSION = "help-2-provisional-2026-07";
var SupportContextSchema = z2.enum([
  "NONE_REPORTED",
  "IFSP",
  "DISABILITY",
  "IFSP_AND_DISABILITY",
  "UNKNOWN"
]);
var ScoringCandidateSchema = z2.object({
  sourceSkillId: z2.string().trim().min(1).max(120),
  skillCode: z2.string().trim().min(1).max(40),
  skillName: z2.string().trim().min(1).max(500),
  domain: z2.string().trim().min(1).max(120),
  strand: z2.string().trim().min(1).max(120).nullable(),
  minimumAgeMonths: z2.number().int().min(0).max(216),
  maximumAgeMonths: z2.number().int().min(0).max(216),
  sourceOrder: z2.number().int().nonnegative()
}).strict().superRefine((candidate, context) => {
  if (candidate.maximumAgeMonths < candidate.minimumAgeMonths) {
    context.addIssue({
      code: "custom",
      path: ["maximumAgeMonths"],
      message: "A candidate maximum age cannot be lower than its minimum age."
    });
  }
});
var ScoringRequestSchema = z2.object({
  contractVersion: z2.literal(SCORING_CONTRACT_VERSION),
  runId: z2.string().trim().min(1).max(160),
  idempotencyKey: z2.string().trim().min(1).max(200),
  catalogVersion: z2.literal(HELP_CATALOG_VERSION),
  observation: z2.object({
    observationDate: z2.iso.date(),
    ageMonthsAtObservation: z2.number().int().min(0).max(216),
    supportContext: SupportContextSchema
  }).strict(),
  video: z2.object({
    videoAssetId: z2.string().trim().min(1).max(160),
    contentType: z2.enum(["video/mp4", "video/webm", "video/quicktime"]),
    byteSize: z2.number().int().positive().max(100 * 1024 * 1024),
    durationSeconds: z2.number().int().positive().max(5 * 60).nullable(),
    checksumSha256: z2.string().regex(/^[a-f0-9]{64}$/).nullable()
  }).strict(),
  candidates: z2.array(ScoringCandidateSchema).min(1).max(500)
}).strict().superRefine((request, context) => {
  const skillIds = /* @__PURE__ */ new Set();
  const orders = /* @__PURE__ */ new Set();
  for (const candidate of request.candidates) {
    if (skillIds.has(candidate.sourceSkillId) || orders.has(candidate.sourceOrder)) {
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "Candidate skill identifiers and source order must be unique."
      });
      return;
    }
    skillIds.add(candidate.sourceSkillId);
    orders.add(candidate.sourceOrder);
  }
});
var ScoringResultSchema = z2.object({
  contractVersion: z2.literal(SCORING_CONTRACT_VERSION),
  runId: z2.string().trim().min(1).max(160),
  outcome: z2.enum(["VALID", "NO_VALID_RESULTS"]),
  scoringConfigurationReference: z2.string().trim().min(1).max(500),
  suggestions: z2.array(SkillSuggestionSchema).max(500)
}).strict().superRefine((result, context) => {
  if (result.outcome === "VALID" && result.suggestions.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["suggestions"],
      message: "A valid scoring result must include at least one suggestion."
    });
  }
  if (result.outcome === "NO_VALID_RESULTS" && result.suggestions.length !== 0) {
    context.addIssue({
      code: "custom",
      path: ["suggestions"],
      message: "A no-valid-results response cannot include partial suggestions."
    });
  }
  const ids = /* @__PURE__ */ new Set();
  const sourceSkillIds = /* @__PURE__ */ new Set();
  const sourceOrders = /* @__PURE__ */ new Set();
  for (const suggestion of result.suggestions) {
    if (ids.has(suggestion.id) || sourceSkillIds.has(suggestion.sourceSkillId) || sourceOrders.has(suggestion.sourceOrder)) {
      context.addIssue({
        code: "custom",
        path: ["suggestions"],
        message: "Suggestion identifiers and source order must be unique."
      });
      return;
    }
    ids.add(suggestion.id);
    sourceSkillIds.add(suggestion.sourceSkillId);
    sourceOrders.add(suggestion.sourceOrder);
  }
});
var MAX_RESULT_BYTES = 1 * 1024 * 1024;
function validateScoringResultForRequest(unparsedRequest, unparsedResult) {
  const request = ScoringRequestSchema.parse(unparsedRequest);
  if (Buffer.byteLength(JSON.stringify(unparsedResult), "utf8") > MAX_RESULT_BYTES) {
    throw new Error("The scoring result exceeds the accepted payload limit.");
  }
  const result = ScoringResultSchema.parse(unparsedResult);
  if (result.runId !== request.runId || result.contractVersion !== request.contractVersion) {
    throw new Error("The scoring result does not match its request identity.");
  }
  const candidates = new Map(request.candidates.map((candidate) => [candidate.sourceSkillId, candidate]));
  for (const suggestion of result.suggestions) {
    const candidate = candidates.get(suggestion.sourceSkillId);
    if (!candidate || suggestion.skillCode !== candidate.skillCode || suggestion.skillName !== candidate.skillName || suggestion.domain !== candidate.domain || suggestion.strand !== candidate.strand || suggestion.sourceOrder !== candidate.sourceOrder) {
      throw new Error("The scoring result contains a skill outside the exact candidate contract.");
    }
    const maximumEvidenceSecond = request.video.durationSeconds ?? 5 * 60;
    if (suggestion.evidence.some(
      (evidence) => evidence.timestampSeconds > maximumEvidenceSecond || (evidence.endTimestampSeconds ?? evidence.timestampSeconds) > maximumEvidenceSecond
    )) {
      throw new Error("The scoring result contains evidence outside the observation duration.");
    }
  }
  return result;
}
var ScoringGatewayError = class extends Error {
  constructor(message, safeCode, retryable) {
    super(message);
    this.safeCode = safeCode;
    this.retryable = retryable;
  }
  safeCode;
  retryable;
};

// lib/help-review/help-catalog.ts
var SANITIZED_HELP_CANDIDATES = [
  { sourceSkillId: "help-1.52", skillCode: "1.52", skillName: "Looks for object that has fallen out of sight", domain: "Cognitive", strand: "Object permanence", minimumAgeMonths: 6, maximumAgeMonths: 18, sourceOrder: 0 },
  { sourceSkillId: "help-1.58", skillCode: "1.58", skillName: "Stacks rings on post in any order", domain: "Cognitive", strand: "Means-end", minimumAgeMonths: 9, maximumAgeMonths: 24, sourceOrder: 1 },
  { sourceSkillId: "help-2.18", skillCode: "2.18", skillName: "Responds to own name", domain: "Language Receptive", strand: "Auditory attention", minimumAgeMonths: 4, maximumAgeMonths: 15, sourceOrder: 2 },
  { sourceSkillId: "help-2.41", skillCode: "2.41", skillName: "Follows simple one-step directions", domain: "Language Receptive", strand: "Comprehension", minimumAgeMonths: 12, maximumAgeMonths: 30, sourceOrder: 3 },
  { sourceSkillId: "help-3.62", skillCode: "3.62", skillName: "Walks independently across room", domain: "Gross Motor", strand: "Locomotion", minimumAgeMonths: 9, maximumAgeMonths: 24, sourceOrder: 4 },
  { sourceSkillId: "help-4.68", skillCode: "4.68", skillName: "Builds tower using two cubes", domain: "Fine Motor", strand: "Block construction", minimumAgeMonths: 12, maximumAgeMonths: 30, sourceOrder: 5 },
  { sourceSkillId: "help-5.41", skillCode: "5.41", skillName: "Shares object spontaneously", domain: "Social-Emotional", strand: "Social interactions", minimumAgeMonths: 12, maximumAgeMonths: 36, sourceOrder: 6 },
  { sourceSkillId: "help-6.22", skillCode: "6.22", skillName: "Drinks from open cup with assistance", domain: "Self-Help", strand: "Feeding", minimumAgeMonths: 9, maximumAgeMonths: 30, sourceOrder: 7 }
];
function selectScoringCandidates(ageMonths, supportContext, candidates = SANITIZED_HELP_CANDIDATES) {
  const ageAppropriate = candidates.filter(
    (candidate) => ageMonths >= candidate.minimumAgeMonths && ageMonths <= candidate.maximumAgeMonths
  );
  const downwardWindow = supportContext === "NONE_REPORTED" ? 6 : 12;
  const downward = candidates.filter(
    (candidate) => candidate.maximumAgeMonths < ageMonths && candidate.maximumAgeMonths >= Math.max(0, ageMonths - downwardWindow)
  );
  const closestLower = candidates.filter((candidate) => candidate.maximumAgeMonths < ageMonths).sort((left, right) => right.maximumAgeMonths - left.maximumAgeMonths).slice(0, 8);
  const selected = ageAppropriate.length > 0 ? [...ageAppropriate, ...downward] : downward.length > 0 ? downward : closestLower.length > 0 ? closestLower : candidates;
  return [...new Map(selected.map((candidate) => [candidate.sourceSkillId, candidate])).values()].sort((left, right) => left.sourceOrder - right.sourceOrder);
}

// lib/help-review/scoring-gateway.ts
import { GoogleGenAI } from "@google/genai";

// lib/help-review/fake-scoring.ts
init_domain();
import { z as z3 } from "zod";
var SanitizedScoringResultSchema = z3.object({
  contractVersion: z3.literal("sandbox-v1"),
  runId: z3.string().min(1),
  suggestions: z3.array(SkillSuggestionSchema).min(1).max(500)
}).strict().superRefine((value, context) => {
  const ids = /* @__PURE__ */ new Set();
  const sourceSkillIds = /* @__PURE__ */ new Set();
  const sourceOrders = /* @__PURE__ */ new Set();
  for (const suggestion of value.suggestions) {
    if (ids.has(suggestion.id) || sourceSkillIds.has(suggestion.sourceSkillId) || sourceOrders.has(suggestion.sourceOrder)) {
      context.addIssue({
        code: "custom",
        path: ["suggestions"],
        message: "Suggestion identifiers and source order must be unique within a result."
      });
      return;
    }
    ids.add(suggestion.id);
    sourceSkillIds.add(suggestion.sourceSkillId);
    sourceOrders.add(suggestion.sourceOrder);
  }
});
function createFakeScoringResult(runId) {
  const result = SanitizedScoringResultSchema.parse({
    contractVersion: "sandbox-v1",
    runId,
    suggestions: [
      {
        id: `${runId}-suggestion-1`,
        sourceSkillId: "help-4.68",
        skillCode: "4.68",
        skillName: "Builds tower using two cubes",
        domain: "Fine Motor",
        strand: "Block construction",
        draftCredit: null,
        confidence: null,
        uncertaintyReason: "The action is visible, but the completion boundary is unclear.",
        evidence: [{ timestampSeconds: 18, explanation: "The child aligns two cubes and releases the upper cube." }],
        sourceOrder: 0
      },
      {
        id: `${runId}-suggestion-2`,
        sourceSkillId: "help-2.41",
        skillCode: "2.41",
        skillName: "Follows simple one-step directions",
        domain: "Language Receptive",
        strand: "Comprehension",
        draftCredit: null,
        confidence: null,
        uncertaintyReason: "The verbal prompt is partially obscured by background sound.",
        evidence: [{ timestampSeconds: 48, explanation: "The educator gives a direction and the child responds with the requested object." }],
        sourceOrder: 1
      },
      {
        id: `${runId}-suggestion-3`,
        sourceSkillId: "help-1.52",
        skillCode: "1.52",
        skillName: "Looks for object that has fallen out of sight",
        domain: "Cognitive",
        strand: "Object permanence",
        draftCredit: "PRESENT",
        confidence: 0.94,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 22, explanation: "The child immediately searches behind the container after the object drops." }],
        sourceOrder: 2
      },
      {
        id: `${runId}-suggestion-4`,
        sourceSkillId: "help-1.58",
        skillCode: "1.58",
        skillName: "Stacks rings on post in any order",
        domain: "Cognitive",
        strand: "Means-end",
        draftCredit: "PRESENT",
        confidence: 0.88,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 67, explanation: "The child places three rings on the post without assistance." }],
        sourceOrder: 3
      },
      {
        id: `${runId}-suggestion-5`,
        sourceSkillId: "help-3.62",
        skillCode: "3.62",
        skillName: "Walks independently across room",
        domain: "Gross Motor",
        strand: "Locomotion",
        draftCredit: "PRESENT",
        confidence: 0.97,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 38, endTimestampSeconds: 44, explanation: "The child crosses the play area without support." }],
        sourceOrder: 4
      },
      {
        id: `${runId}-suggestion-6`,
        sourceSkillId: "help-5.41",
        skillCode: "5.41",
        skillName: "Shares object spontaneously",
        domain: "Social-Emotional",
        strand: "Social interactions",
        draftCredit: "EMERGING",
        confidence: 0.72,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 91, explanation: "The child offers a toy, then pulls it back before the peer takes it." }],
        sourceOrder: 5
      },
      {
        id: `${runId}-suggestion-7`,
        sourceSkillId: "help-2.18",
        skillCode: "2.18",
        skillName: "Responds to own name",
        domain: "Language Receptive",
        strand: "Auditory attention",
        draftCredit: "NOT_OBSERVED",
        confidence: 0.84,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 75, explanation: "Two clear name calls occur without an observable orientation response." }],
        sourceOrder: 6
      },
      {
        id: `${runId}-suggestion-8`,
        sourceSkillId: "help-6.22",
        skillCode: "6.22",
        skillName: "Drinks from open cup with assistance",
        domain: "Self-Help",
        strand: "Feeding",
        draftCredit: "NOT_APPLICABLE",
        confidence: 0.91,
        uncertaintyReason: null,
        evidence: [{ timestampSeconds: 106, explanation: "No open-cup opportunity occurs in the observation." }],
        sourceOrder: 7
      }
    ]
  });
  return result.suggestions;
}

// lib/help-review/scoring-gateway.ts
var FakeScoringGateway = class {
  constructor(scenario = "accepted") {
    this.scenario = scenario;
  }
  scenario;
  name = "fake";
  async score(request, media) {
    void media;
    const validated = ScoringRequestSchema.parse(request);
    if (this.scenario === "slow") await new Promise((resolve) => setTimeout(resolve, 50));
    if (this.scenario === "retryable-failure") {
      throw new ScoringGatewayError("Synthetic retryable failure.", "SCORING_UNAVAILABLE", true);
    }
    if (this.scenario === "terminal-failure") {
      throw new ScoringGatewayError("Synthetic terminal failure.", "SCORING_AUTHENTICATION_FAILED", false);
    }
    if (["invalid-credit", "invalid-evidence", "empty-result"].includes(this.scenario)) {
      throw new ScoringGatewayError("Synthetic invalid contract response.", "INVALID_RESULT", false);
    }
    if (this.scenario === "no-valid-results") {
      return ScoringResultSchema.parse({
        contractVersion: validated.contractVersion,
        runId: validated.runId,
        outcome: "NO_VALID_RESULTS",
        scoringConfigurationReference: "fake:sandbox-v1:no-valid-results",
        suggestions: []
      });
    }
    const suggestions = createFakeScoringResult(validated.runId).filter(
      (suggestion) => validated.candidates.some((candidate) => candidate.sourceSkillId === suggestion.sourceSkillId)
    );
    const selected = this.scenario === "uncertain" ? suggestions.filter((suggestion) => suggestion.draftCredit === null) : suggestions;
    return validateScoringResultForRequest(validated, ScoringResultSchema.parse({
      contractVersion: validated.contractVersion,
      runId: validated.runId,
      outcome: selected.length > 0 ? "VALID" : "NO_VALID_RESULTS",
      scoringConfigurationReference: "fake:sandbox-v1:help-2-provisional-2026-07",
      suggestions: selected.map((suggestion) => {
        const maximumSecond = validated.video.durationSeconds ?? 5 * 60;
        return {
          ...suggestion,
          sourceOrder: validated.candidates.find((candidate) => candidate.sourceSkillId === suggestion.sourceSkillId).sourceOrder,
          evidence: suggestion.evidence.map((evidence) => ({
            ...evidence,
            timestampSeconds: Math.min(evidence.timestampSeconds, maximumSecond),
            endTimestampSeconds: evidence.endTimestampSeconds === void 0 ? void 0 : Math.min(evidence.endTimestampSeconds, maximumSecond)
          }))
        };
      })
    }));
  }
};
function timeoutSignal(timeoutMs) {
  return AbortSignal.timeout(timeoutMs);
}
function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["outcome", "suggestions"],
    properties: {
      outcome: { type: "string", enum: ["VALID", "NO_VALID_RESULTS"] },
      suggestions: {
        type: "array",
        maxItems: 500,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sourceSkillId", "draftCredit", "confidence", "uncertaintyReason", "evidence"],
          properties: {
            sourceSkillId: { type: "string" },
            draftCredit: {
              anyOf: [
                { type: "string", enum: ["PRESENT", "EMERGING", "NOT_OBSERVED", "NOT_APPLICABLE"] },
                { type: "null" }
              ]
            },
            confidence: { anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }] },
            uncertaintyReason: { anyOf: [{ type: "string" }, { type: "null" }] },
            evidence: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["timestampSeconds", "explanation"],
                properties: {
                  timestampSeconds: { type: "integer", minimum: 0 },
                  endTimestampSeconds: { type: "integer", minimum: 0 },
                  explanation: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  };
}
function scoringPrompt(request) {
  const candidates = request.candidates.map((candidate) => ({
    sourceSkillId: candidate.sourceSkillId,
    skillCode: candidate.skillCode,
    skillName: candidate.skillName,
    domain: candidate.domain,
    strand: candidate.strand,
    ageRangeMonths: [candidate.minimumAgeMonths, candidate.maximumAgeMonths],
    sourceOrder: candidate.sourceOrder
  }));
  return [
    "You are producing provisional HELP Review decision-support suggestions from one sanitized observation video.",
    "Never invent a skill. Use only sourceSkillId values in the supplied candidate list.",
    "The educator remains the final decision maker. If evidence is insufficient, set draftCredit to null and provide uncertaintyReason.",
    "Return timestamped, directly observable evidence. Do not infer diagnoses, intent, identity, or unobserved behavior.",
    "Use age order as context, but do not apply an unconfirmed two-consecutive-minus stopping rule.",
    JSON.stringify({ observation: request.observation, candidates })
  ].join("\n\n");
}
function mapGeminiFailure(status) {
  if (status === 401 || status === 403) {
    return new ScoringGatewayError("Gemini authentication failed.", "SCORING_AUTHENTICATION_FAILED", false);
  }
  if (status === 429) {
    return new ScoringGatewayError("Gemini rate limited the request.", "SCORING_RATE_LIMITED", true);
  }
  return new ScoringGatewayError("Gemini was unavailable.", "SCORING_UNAVAILABLE", status >= 500);
}
var GeminiScoringGateway = class {
  constructor(options) {
    this.options = options;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 18e4;
  }
  options;
  name = "gemini-sandbox";
  fetchImplementation;
  timeoutMs;
  async request(url, init) {
    try {
      const response = await this.fetchImplementation(url, {
        ...init,
        headers: { "x-goog-api-key": this.options.apiKey, ...init.headers },
        signal: init.signal ?? timeoutSignal(this.timeoutMs)
      });
      if (!response.ok) throw mapGeminiFailure(response.status);
      return response;
    } catch (error) {
      if (error instanceof ScoringGatewayError) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new ScoringGatewayError("Gemini timed out.", "SCORING_TIMEOUT", true);
      }
      throw new ScoringGatewayError("Gemini could not be reached.", "SCORING_UNAVAILABLE", true);
    }
  }
  async upload(media, displayName) {
    if (media.kind !== "bytes") {
      throw new ScoringGatewayError(
        "The Gemini Files adapter requires direct video bytes.",
        "VIDEO_UNAVAILABLE",
        false
      );
    }
    const start = await this.request("https://generativelanguage.googleapis.com/upload/v1beta/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(media.bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": media.contentType
      },
      body: JSON.stringify({ file: { display_name: displayName } })
    });
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      throw new ScoringGatewayError("Gemini did not issue an upload URL.", "SCORING_UNAVAILABLE", true);
    }
    const uploaded = await this.request(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(media.bytes.byteLength),
        "Content-Type": media.contentType,
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize"
      },
      body: new Blob([media.bytes.slice().buffer], { type: media.contentType })
    });
    const payload = await uploaded.json();
    if (!payload.file?.name || !payload.file.uri) {
      throw new ScoringGatewayError("Gemini returned invalid upload metadata.", "SCORING_UNAVAILABLE", true);
    }
    return payload.file;
  }
  async waitForFile(file) {
    const deadline = Date.now() + this.timeoutMs;
    let current = file;
    while (current.state === "PROCESSING" || !current.state) {
      if (Date.now() >= deadline) {
        throw new ScoringGatewayError("Gemini file processing timed out.", "SCORING_TIMEOUT", true);
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const response = await this.request(`https://generativelanguage.googleapis.com/v1beta/${current.name}`, { method: "GET" });
      current = await response.json();
    }
    if (current.state !== "ACTIVE") {
      throw new ScoringGatewayError("Gemini rejected the video input.", "VIDEO_UNAVAILABLE", false);
    }
    return current;
  }
  async removeFile(file) {
    try {
      await this.request(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { method: "DELETE" });
    } catch {
    }
  }
  async score(unparsedRequest, media) {
    const request = ScoringRequestSchema.parse(unparsedRequest);
    let file;
    try {
      file = await this.waitForFile(await this.upload(media, request.runId));
      const response = await this.request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { fileData: { fileUri: file.uri, mimeType: file.mimeType ?? media.contentType } },
                { text: scoringPrompt(request) }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseJsonSchema: responseSchema()
            }
          })
        }
      );
      const payload = await response.json();
      const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      if (!text) {
        throw new ScoringGatewayError("Gemini returned no structured result.", "INVALID_RESULT", false);
      }
      const raw = JSON.parse(text);
      const candidateById = new Map(request.candidates.map((candidate) => [candidate.sourceSkillId, candidate]));
      return validateScoringResultForRequest(request, ScoringResultSchema.parse({
        contractVersion: request.contractVersion,
        runId: request.runId,
        outcome: raw.outcome,
        scoringConfigurationReference: `gemini:${this.options.model}:help-v0:${request.catalogVersion}`,
        suggestions: raw.suggestions.map((suggestion, index) => {
          const candidate = candidateById.get(suggestion.sourceSkillId);
          if (!candidate) throw new Error("The model returned a skill outside the candidate allowlist.");
          return {
            id: `${request.runId}-suggestion-${index + 1}`,
            sourceSkillId: candidate.sourceSkillId,
            skillCode: candidate.skillCode,
            skillName: candidate.skillName,
            domain: candidate.domain,
            strand: candidate.strand,
            draftCredit: suggestion.draftCredit,
            confidence: suggestion.confidence,
            uncertaintyReason: suggestion.uncertaintyReason,
            evidence: suggestion.evidence,
            sourceOrder: candidate.sourceOrder
          };
        })
      }));
    } catch (error) {
      if (error instanceof ScoringGatewayError) throw error;
      throw new ScoringGatewayError("The scoring response failed validation.", "INVALID_RESULT", false);
    } finally {
      if (file) await this.removeFile(file);
    }
  }
};
function modelResult(request, text, scoringConfigurationReference) {
  const raw = JSON.parse(text);
  const candidateById = new Map(request.candidates.map((candidate) => [candidate.sourceSkillId, candidate]));
  return validateScoringResultForRequest(request, ScoringResultSchema.parse({
    contractVersion: request.contractVersion,
    runId: request.runId,
    outcome: raw.outcome,
    scoringConfigurationReference,
    suggestions: raw.suggestions.map((suggestion, index) => {
      const candidate = candidateById.get(suggestion.sourceSkillId);
      if (!candidate) throw new Error("The model returned a skill outside the candidate allowlist.");
      return {
        id: `${request.runId}-suggestion-${index + 1}`,
        sourceSkillId: candidate.sourceSkillId,
        skillCode: candidate.skillCode,
        skillName: candidate.skillName,
        domain: candidate.domain,
        strand: candidate.strand,
        draftCredit: suggestion.draftCredit,
        confidence: suggestion.confidence,
        uncertaintyReason: suggestion.uncertaintyReason,
        evidence: suggestion.evidence,
        sourceOrder: candidate.sourceOrder
      };
    })
  }));
}
function vertexFailure(error) {
  const candidate = error;
  const status = candidate.status ?? candidate.code;
  if (status === 401 || status === 403) {
    return new ScoringGatewayError("Vertex AI authentication failed.", "SCORING_AUTHENTICATION_FAILED", false);
  }
  if (status === 429) {
    return new ScoringGatewayError("Vertex AI rate limited the request.", "SCORING_RATE_LIMITED", true);
  }
  if (status === 408 || status === 504 || candidate.name === "TimeoutError") {
    return new ScoringGatewayError("Vertex AI timed out.", "SCORING_TIMEOUT", true);
  }
  return new ScoringGatewayError("Vertex AI was unavailable.", "SCORING_UNAVAILABLE", !status || status >= 500);
}
var VertexScoringGateway = class {
  constructor(options) {
    this.options = options;
    this.client = new GoogleGenAI({
      vertexai: true,
      project: options.project,
      location: options.location,
      apiVersion: "v1"
    });
  }
  options;
  name = "vertex";
  client;
  async score(unparsedRequest, media) {
    const request = ScoringRequestSchema.parse(unparsedRequest);
    if (media.kind !== "gcs") {
      throw new ScoringGatewayError(
        "Vertex AI requires the canonical Google Cloud Storage object.",
        "VIDEO_UNAVAILABLE",
        false
      );
    }
    try {
      const response = await this.client.models.generateContent({
        model: this.options.model,
        contents: [{
          role: "user",
          parts: [
            { fileData: { fileUri: media.uri, mimeType: media.contentType } },
            { text: scoringPrompt(request) }
          ]
        }],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema(),
          httpOptions: { timeout: this.options.timeoutMs ?? 18e4 }
        }
      });
      if (!response.text) {
        throw new ScoringGatewayError("Vertex AI returned no structured result.", "INVALID_RESULT", false);
      }
      return modelResult(
        request,
        response.text,
        `vertex:${this.options.location}:${this.options.model}:help-v0:${request.catalogVersion}`
      );
    } catch (error) {
      if (error instanceof ScoringGatewayError) throw error;
      if (error instanceof SyntaxError || error instanceof Error && /candidate|validation|result/i.test(error.message)) {
        throw new ScoringGatewayError("The Vertex AI result failed validation.", "INVALID_RESULT", false);
      }
      throw vertexFailure(error);
    }
  }
};
function selectedScoringGateway(environment = process.env) {
  const adapter = environment.HELP_REVIEW_SCORING_ADAPTER ?? "fake";
  if (adapter === "fake") {
    const scenario = environment.HELP_REVIEW_FAKE_SCORING_SCENARIO ?? "accepted";
    const accepted = /* @__PURE__ */ new Set([
      "accepted",
      "uncertain",
      "no-valid-results",
      "invalid-credit",
      "invalid-evidence",
      "empty-result",
      "slow",
      "retryable-failure",
      "terminal-failure"
    ]);
    if (!accepted.has(scenario)) throw new Error(`Unsupported fake scoring scenario: ${scenario}`);
    return new FakeScoringGateway(scenario);
  }
  if (adapter === "gemini") {
    const apiKey = environment.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required for the Gemini scoring adapter.");
    return new GeminiScoringGateway({
      apiKey,
      model: environment.GEMINI_MODEL ?? "gemini-2.5-flash"
    });
  }
  if (adapter === "vertex") {
    const project = environment.GOOGLE_CLOUD_PROJECT || environment.GCLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is required for the Vertex AI scoring adapter.");
    return new VertexScoringGateway({
      project,
      location: environment.VERTEX_AI_LOCATION ?? "us-central1",
      model: environment.VERTEX_AI_MODEL ?? "gemini-2.5-flash"
    });
  }
  throw new Error(`Unsupported scoring adapter: ${adapter}`);
}

// lib/help-review/server-store.ts
init_fixtures();
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// lib/help-review/runtime-config.ts
function assertRuntimeConfiguration(environment = process.env) {
  if (environment.NODE_ENV !== "production") return;
  const realDataEnabled = environment.HELP_REVIEW_REAL_DATA_ENABLED === "true";
  const identityAdapter = environment.HELP_REVIEW_IDENTITY_ADAPTER ?? "sandbox";
  const scoringAdapter = environment.HELP_REVIEW_SCORING_ADAPTER ?? "fake";
  const serviceRole = environment.HELP_REVIEW_SERVICE_ROLE ?? "web";
  const workerSecret = environment.HELP_REVIEW_WORKER_SECRET ?? environment.CRON_SECRET;
  if (realDataEnabled) {
    const missing = [
      "HELP_REVIEW_REAL_DATA_APPROVAL_ID",
      "HELP_REVIEW_IDENTITY_ADAPTER",
      "HELP_REVIEW_SCORING_ADAPTER"
    ].filter((key) => !environment[key]);
    if (!workerSecret) missing.push("HELP_REVIEW_WORKER_SECRET or CRON_SECRET");
    if (missing.length > 0) {
      throw new Error(`Real-data configuration is incomplete: ${missing.join(", ")}`);
    }
    if (identityAdapter === "sandbox") {
      throw new Error("The sandbox identity adapter is forbidden when real child data is enabled.");
    }
    if (scoringAdapter === "fake" || scoringAdapter === "gemini") {
      throw new Error("Sandbox scoring adapters are forbidden when real child data is enabled.");
    }
  } else if (environment.HELP_REVIEW_SANITIZED_PRODUCTION_ACK !== "true") {
    throw new Error(
      "Sanitized identity and scoring adapters are not approved for production. Select the approved provider adapters before enabling real data."
    );
  }
  if (!(/* @__PURE__ */ new Set(["neon", "pg"])).has(environment.HELP_REVIEW_STATE_ADAPTER ?? "") || !environment.DATABASE_URL) {
    throw new Error("An acknowledged sanitized deployment must use the Neon state adapter or durable PostgreSQL adapter.");
  }
  if (serviceRole === "web") {
    if (!environment.HELP_REVIEW_SESSION_SECRET || environment.HELP_REVIEW_SESSION_SECRET.length < 32) {
      throw new Error("Production requires HELP_REVIEW_SESSION_SECRET with at least 32 characters.");
    }
    if (!environment.HELP_REVIEW_PLAYBACK_GRANT_SECRET || environment.HELP_REVIEW_PLAYBACK_GRANT_SECRET.length < 32) {
      throw new Error("Production requires HELP_REVIEW_PLAYBACK_GRANT_SECRET with at least 32 characters.");
    }
  }
  if (!workerSecret || workerSecret.length < 32) {
    throw new Error("Production requires HELP_REVIEW_WORKER_SECRET or CRON_SECRET with at least 32 characters.");
  }
  const videoAdapter = environment.HELP_REVIEW_VIDEO_ADAPTER;
  if (videoAdapter === "vercel-blob") {
    if (!environment.BLOB_READ_WRITE_TOKEN) {
      throw new Error("The private Vercel Blob adapter requires BLOB_READ_WRITE_TOKEN.");
    }
  } else if (videoAdapter === "gcs") {
    if (!environment.GCS_VIDEO_BUCKET || !(environment.GOOGLE_CLOUD_PROJECT || environment.GCLOUD_PROJECT)) {
      throw new Error("The GCS video adapter requires GCS_VIDEO_BUCKET and GOOGLE_CLOUD_PROJECT.");
    }
    if (serviceRole === "web" && (!environment.HELP_REVIEW_UPLOAD_GRANT_SECRET || environment.HELP_REVIEW_UPLOAD_GRANT_SECRET.length < 32)) {
      throw new Error("The GCS web service requires HELP_REVIEW_UPLOAD_GRANT_SECRET with at least 32 characters.");
    }
  } else {
    throw new Error("An acknowledged sanitized deployment must use an authenticated private Blob store or GCS bucket.");
  }
  if (identityAdapter !== "sandbox") {
    throw new Error("The selected live identity adapter is not implemented or approved.");
  }
  if (!(/* @__PURE__ */ new Set(["fake", "gemini", "vertex"])).has(scoringAdapter)) {
    throw new Error("The selected scoring adapter is not supported.");
  }
  if (scoringAdapter === "gemini" && !environment.GEMINI_API_KEY) {
    throw new Error("The Gemini scoring adapter requires GEMINI_API_KEY.");
  }
  if (scoringAdapter === "vertex" && !(environment.GOOGLE_CLOUD_PROJECT || environment.GCLOUD_PROJECT)) {
    throw new Error("The Vertex AI scoring adapter requires GOOGLE_CLOUD_PROJECT.");
  }
  const processingAdapter = environment.HELP_REVIEW_PROCESSING_ADAPTER ?? "inline";
  if (videoAdapter === "gcs" && serviceRole === "web" && processingAdapter !== "gcs-event") {
    throw new Error("The GCS web service must dispatch durable processing requests with the gcs-event adapter.");
  }
}

// lib/help-review/server-store.ts
var dataDirectory = path.join(process.cwd(), ".data");
var statePath = path.join(dataDirectory, "pilot-state.json");
var stateLockPath = path.join(dataDirectory, "pilot-state.lock");
var writeQueue = Promise.resolve();
async function pause(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function withLocalStateLock(operation) {
  const deadline = Date.now() + 15e3;
  while (true) {
    try {
      await mkdir(stateLockPath);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const metadata = await stat(stateLockPath);
        if (Date.now() - metadata.mtimeMs > 6e4) {
          await rm(stateLockPath, { recursive: true, force: true });
          continue;
        }
      } catch (metadataError) {
        if (metadataError.code !== "ENOENT") throw metadataError;
      }
      if (Date.now() >= deadline) throw new Error("Timed out waiting for the local state transaction lock.");
      await pause(25);
    }
  }
  try {
    return await operation();
  } finally {
    await rm(stateLockPath, { recursive: true, force: true });
  }
}
async function ensureState() {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(statePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(statePath, JSON.stringify(createSanitizedPilotState(), null, 2), "utf8");
  }
}
async function readPilotState() {
  assertRuntimeConfiguration();
  if (["neon", "pg"].includes(process.env.HELP_REVIEW_STATE_ADAPTER ?? "")) {
    const { readNeonPilotState: readNeonPilotState2 } = await Promise.resolve().then(() => (init_neon_store(), neon_store_exports));
    return readNeonPilotState2();
  }
  await ensureState();
  const raw = await readFile(statePath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed.fixtureVersion !== 1 || !Array.isArray(parsed.users) || !Array.isArray(parsed.assessments)) {
    throw new Error("The local pilot state has an unsupported shape.");
  }
  parsed.supportEvents ??= [];
  parsed.videoAccessGrants ??= [];
  for (const admin of parsed.users.filter((user) => user.role === "ADMIN")) {
    if (!parsed.access.some((provision) => provision.userId === admin.id)) {
      parsed.access.push({
        id: `access-${admin.id}`,
        exactEmail: admin.email,
        userId: admin.id,
        role: "ADMIN",
        active: admin.isActive,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedById: admin.id
      });
    }
  }
  for (const assessment of parsed.assessments) {
    assessment.revision ??= 0;
    assessment.finalizationKey ??= null;
    Object.assign(assessment, {
      contentCatalogVersion: assessment.contentCatalogVersion ?? "help-2-provisional-2026-07",
      scoringContractVersion: assessment.scoringContractVersion ?? "help-scoring-v0"
    });
  }
  return parsed;
}
async function updatePilotState(mutation) {
  assertRuntimeConfiguration();
  if (["neon", "pg"].includes(process.env.HELP_REVIEW_STATE_ADAPTER ?? "")) {
    const { updateNeonPilotState: updateNeonPilotState2 } = await Promise.resolve().then(() => (init_neon_store(), neon_store_exports));
    return updateNeonPilotState2(mutation);
  }
  let result;
  const operation = writeQueue.then(() => withLocalStateLock(async () => {
    const state = await readPilotState();
    result = await mutation(state);
    const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
    await rename(temporaryPath, statePath);
  }));
  writeQueue = operation.catch(() => void 0);
  await operation;
  return result;
}
function uploadDirectory() {
  return path.join(dataDirectory, "uploads");
}

// lib/help-review/video-storage.ts
init_gcs_storage();
import { createHash as createHash2 } from "node:crypto";
import { readFile as readFile2 } from "node:fs/promises";
import path2 from "node:path";
function mediaType(video) {
  if (["video/mp4", "video/webm", "video/quicktime"].includes(video.contentType)) {
    return video.contentType;
  }
  throw new Error("The stored video type is not supported by the scoring contract.");
}
function sha256(bytes) {
  return createHash2("sha256").update(bytes).digest("hex");
}
var LocalVideoStorage = class {
  name = "local";
  async readForScoring(video) {
    const bytes = await readFile2(path2.join(uploadDirectory(), path2.basename(video.storageKey)));
    if (bytes.byteLength !== video.byteSize) {
      throw new Error("The private video object size does not match its verified metadata.");
    }
    return { kind: "bytes", bytes, contentType: mediaType(video) };
  }
  async checksum(video) {
    const media = await this.readForScoring(video);
    if (media.kind !== "bytes") throw new Error("The local video bytes are unavailable.");
    return sha256(media.bytes);
  }
};
var VercelBlobVideoStorage = class {
  name = "vercel-blob";
  async readForScoring(video) {
    const { get } = await import("@vercel/blob");
    const result = await get(video.storageKey, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("The private video object is unavailable.");
    }
    const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
    if (bytes.byteLength !== video.byteSize) {
      throw new Error("The private video object size does not match its verified metadata.");
    }
    return { kind: "bytes", bytes, contentType: mediaType(video) };
  }
  async checksum(video) {
    const media = await this.readForScoring(video);
    if (media.kind !== "bytes") throw new Error("The private Blob video bytes are unavailable.");
    return sha256(media.bytes);
  }
};
var GcsVideoStorage = class {
  name = "gcs";
  async readForScoring(video) {
    const bucket = video.storageBucket ?? configuredGcsBucket();
    const object = await inspectGcsObject(video.storageKey, video.storageGeneration, bucket);
    if (object.byteSize !== video.byteSize || object.contentType !== video.contentType || video.checksumCrc32c && object.crc32c !== video.checksumCrc32c) {
      throw new Error("The private Google Cloud video object does not match its verified metadata.");
    }
    return {
      kind: "gcs",
      uri: `gs://${bucket}/${video.storageKey}`,
      contentType: mediaType(video),
      generation: object.generation
    };
  }
  async checksum(video) {
    return video.checksumSha256 ?? sha256GcsObject(video);
  }
};
function selectedVideoStorage(environment = process.env) {
  const adapter = environment.HELP_REVIEW_VIDEO_ADAPTER ?? "local";
  if (adapter === "local") return new LocalVideoStorage();
  if (adapter === "vercel-blob") return new VercelBlobVideoStorage();
  if (adapter === "gcs") return new GcsVideoStorage();
  throw new Error(`Unsupported video storage adapter: ${adapter}`);
}

// lib/help-review/processing-coordinator.ts
var STUCK_AFTER_MS = 15 * 60 * 1e3;
var RUN_LEASE_MS = 5 * 60 * 1e3;
function contextSnapshotForChild(child, capturedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const label = child.contextLabel?.toLowerCase() ?? "";
  const hasIfsp = /ifsp:\s*yes|\bifsp\b(?!:\s*no)/i.test(label);
  const hasDisability = /disabil/i.test(label);
  const supportContext = hasIfsp && hasDisability ? "IFSP_AND_DISABILITY" : hasIfsp ? "IFSP" : hasDisability ? "DISABILITY" : child.contextLabel === null || /:\s*no\b/i.test(label) ? "NONE_REPORTED" : "UNKNOWN";
  return {
    ageMonthsAtObservation: child.ageMonths,
    supportContext,
    contextLabel: child.contextLabel,
    processingAllowedAtCreation: child.processingAllowed,
    capturedAt,
    source: "SANITIZED_ADMIN"
  };
}
function markStuckRuns(state, now = /* @__PURE__ */ new Date()) {
  let changed = 0;
  for (const assessment of state.assessments) {
    const run = assessment.runs.at(-1);
    if (!run || run.status !== "RUNNING" && run.status !== "QUEUED") continue;
    const startedAt = run.startedAt ?? run.requestedAt;
    if (now.getTime() - new Date(startedAt).getTime() < STUCK_AFTER_MS) continue;
    run.status = "FAILED";
    run.completedAt = now.toISOString();
    run.safeErrorCode = "PROCESSING_STUCK";
    assessment.status = "FAILED";
    assessment.updatedAt = now.toISOString();
    assessment.revision = (assessment.revision ?? 0) + 1;
    changed += 1;
  }
  return changed;
}
var RetryableProcessingError = class extends Error {
  constructor(safeCode) {
    super("Processing should be delivered again.");
    this.safeCode = safeCode;
  }
  safeCode;
};
function defaultDependencies() {
  return {
    readState: readPilotState,
    updateState: updatePilotState,
    scoringGateway: selectedScoringGateway(),
    videoStorage: selectedVideoStorage()
  };
}
async function claimRun(dependencies, requestedRunId, trigger = {}) {
  return dependencies.updateState((state) => {
    if (!requestedRunId) markStuckRuns(state);
    for (const assessment of state.assessments) {
      const run = requestedRunId ? assessment.runs.find((candidate) => candidate.id === requestedRunId) : assessment.runs.at(-1);
      if (!run || requestedRunId && run.id !== requestedRunId) continue;
      if (assessment.runs.at(-1)?.id !== run.id) {
        return { claim: null, disposition: "ALREADY_HANDLED" };
      }
      if (run.status === "COMPLETED" || run.status === "FAILED") {
        return { claim: null, disposition: "ALREADY_HANDLED" };
      }
      if (run.status === "RUNNING") {
        const leaseAge = Date.now() - new Date(run.startedAt ?? run.requestedAt).getTime();
        if (leaseAge < RUN_LEASE_MS) {
          return { claim: null, disposition: "IN_PROGRESS" };
        }
        run.status = "QUEUED";
        run.startedAt = null;
      }
      if (run.status !== "QUEUED" || !assessment.video) {
        return { claim: null, disposition: "NOT_READY" };
      }
      if (assessment.runs.some((candidate) => candidate.id !== run.id && candidate.status === "RUNNING")) continue;
      if (assessment.decisions.length > 0) {
        const now2 = (/* @__PURE__ */ new Date()).toISOString();
        run.status = "FAILED";
        run.completedAt = now2;
        run.safeErrorCode = "RESULT_REPLACEMENT_BLOCKED";
        assessment.status = "FAILED";
        assessment.updatedAt = now2;
        assessment.revision = (assessment.revision ?? 0) + 1;
        return { claim: null, disposition: "FAILED" };
      }
      const child = state.children.find((candidate) => candidate.id === assessment.childId && candidate.isActive);
      if (!child || !child.processingAllowed) {
        const now2 = (/* @__PURE__ */ new Date()).toISOString();
        run.status = "FAILED";
        run.completedAt = now2;
        run.safeErrorCode = "PROCESSING_NOT_ALLOWED";
        assessment.status = "FAILED";
        assessment.updatedAt = now2;
        assessment.revision = (assessment.revision ?? 0) + 1;
        return { claim: null, disposition: "FAILED" };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      run.status = "RUNNING";
      run.startedAt = now;
      run.scoringConfigurationReference = "pending";
      if (trigger.eventId) run.triggerEventId ??= trigger.eventId;
      if (trigger.objectGeneration) run.triggerObjectGeneration ??= trigger.objectGeneration;
      if (trigger.eventId || trigger.objectGeneration) {
        run.deliveryCount = (run.deliveryCount ?? 0) + 1;
        run.lastDispatchedAt = now;
      }
      assessment.status = "PROCESSING";
      assessment.updatedAt = now;
      return {
        claim: {
          assessmentId: assessment.id,
          runId: run.id,
          deliveryCount: run.deliveryCount ?? 0
        },
        disposition: "NOT_READY"
      };
    }
    return { claim: null, disposition: requestedRunId ? "NOT_FOUND" : "NOT_READY" };
  });
}
function findClaimed(state, claim) {
  const assessment = state.assessments.find((candidate) => candidate.id === claim.assessmentId);
  const child = state.children.find((candidate) => candidate.id === assessment?.childId);
  if (!assessment || !child || assessment.runs.at(-1)?.id !== claim.runId || !assessment.video) {
    throw new Error("The claimed processing run is no longer available.");
  }
  return { assessment, child };
}
async function executeClaim(claim, dependencies, trigger = {}) {
  const outcomeStartedAt = Date.now();
  const state = await dependencies.readState();
  const { assessment, child } = findClaimed(state, claim);
  const run = assessment.runs.at(-1);
  const video = assessment.video;
  const snapshot = assessment.contextSnapshot ?? contextSnapshotForChild(child, assessment.createdAt);
  const candidates = selectScoringCandidates(snapshot.ageMonthsAtObservation, snapshot.supportContext);
  const request = ScoringRequestSchema.parse({
    contractVersion: assessment.scoringContractVersion ?? SCORING_CONTRACT_VERSION,
    runId: run.id,
    idempotencyKey: run.externalJobId,
    catalogVersion: assessment.contentCatalogVersion ?? HELP_CATALOG_VERSION,
    observation: {
      observationDate: assessment.observationDate,
      ageMonthsAtObservation: snapshot.ageMonthsAtObservation,
      supportContext: snapshot.supportContext
    },
    video: {
      videoAssetId: video.id,
      contentType: video.contentType,
      byteSize: video.byteSize,
      durationSeconds: video.durationSeconds ?? null,
      checksumSha256: video.checksumSha256 ?? null
    },
    candidates
  });
  try {
    let media;
    try {
      media = await dependencies.videoStorage.readForScoring(video);
    } catch {
      throw new ScoringGatewayError("The private source video is unavailable.", "VIDEO_UNAVAILABLE", false);
    }
    if (video.checksumSha256 && media.kind === "bytes") {
      const actual = createHash3("sha256").update(media.bytes).digest("hex");
      if (actual !== video.checksumSha256) {
        throw new ScoringGatewayError("The private source video failed integrity validation.", "VIDEO_UNAVAILABLE", false);
      }
    }
    const gatewayResult = await dependencies.scoringGateway.score(request, media);
    let result;
    try {
      result = validateScoringResultForRequest(request, gatewayResult);
    } catch {
      throw new ScoringGatewayError("The scoring response failed validation.", "INVALID_RESULT", false);
    }
    await dependencies.updateState((current) => {
      const currentAssessment = current.assessments.find((candidate) => candidate.id === claim.assessmentId);
      const currentRun = currentAssessment?.runs.at(-1);
      if (!currentAssessment || currentRun?.id !== claim.runId || currentRun.status !== "RUNNING") return;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      currentRun.completedAt = now;
      currentRun.scoringConfigurationReference = result.scoringConfigurationReference;
      if (result.outcome === "NO_VALID_RESULTS") {
        currentRun.status = "FAILED";
        currentRun.safeErrorCode = "INVALID_RESULT";
        currentAssessment.status = "FAILED";
        currentAssessment.suggestions = [];
      } else {
        currentRun.status = "COMPLETED";
        currentRun.safeErrorCode = null;
        currentAssessment.suggestions = [...result.suggestions];
        currentAssessment.decisions = [];
        currentAssessment.status = "READY_FOR_REVIEW";
      }
      currentAssessment.updatedAt = now;
      currentAssessment.revision = (currentAssessment.revision ?? 0) + 1;
    });
    console.info(JSON.stringify({
      event: "help_review_processing_outcome",
      runId: claim.runId,
      gateway: dependencies.scoringGateway.name,
      outcome: result.outcome === "VALID" ? "COMPLETED" : "NO_VALID_RESULTS",
      durationMs: Date.now() - outcomeStartedAt,
      retryable: false
    }));
    return result.outcome === "VALID" ? "COMPLETED" : "FAILED";
  } catch (error) {
    const safeCode = error instanceof ScoringGatewayError ? error.safeCode : "SCORING_UNAVAILABLE";
    const retryable = error instanceof ScoringGatewayError ? error.retryable : true;
    const configuredMaxDeliveries = Number(process.env.HELP_REVIEW_MAX_PROCESSING_DELIVERIES ?? 5);
    const maxDeliveries = Number.isInteger(configuredMaxDeliveries) && configuredMaxDeliveries > 0 ? configuredMaxDeliveries : 5;
    const requeue = Boolean(trigger.retryDelivery && retryable && claim.deliveryCount < maxDeliveries);
    await dependencies.updateState((current) => {
      const currentAssessment = current.assessments.find((candidate) => candidate.id === claim.assessmentId);
      const currentRun = currentAssessment?.runs.at(-1);
      if (!currentAssessment || currentRun?.id !== claim.runId || currentRun.status !== "RUNNING") return;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      currentRun.status = requeue ? "QUEUED" : "FAILED";
      currentRun.startedAt = requeue ? null : currentRun.startedAt;
      currentRun.completedAt = requeue ? null : now;
      currentRun.safeErrorCode = safeCode;
      currentAssessment.status = requeue ? "PROCESSING" : "FAILED";
      currentAssessment.suggestions = [];
      currentAssessment.updatedAt = now;
      currentAssessment.revision = (currentAssessment.revision ?? 0) + 1;
    });
    console.info(JSON.stringify({
      event: "help_review_processing_outcome",
      runId: claim.runId,
      gateway: dependencies.scoringGateway.name,
      outcome: requeue ? "REQUEUED" : "FAILED",
      safeCode,
      durationMs: Date.now() - outcomeStartedAt,
      retryable
    }));
    if (requeue) throw new RetryableProcessingError(safeCode);
    return "FAILED";
  }
}
async function processRunById(runId, trigger = {}, suppliedDependencies) {
  const dependencies = suppliedDependencies ?? defaultDependencies();
  const claimed = await claimRun(dependencies, runId, trigger);
  if (!claimed.claim) return { processed: false, disposition: claimed.disposition };
  const disposition = await executeClaim(claimed.claim, dependencies, trigger);
  return { processed: true, disposition };
}

// lib/help-review/processing-dispatcher.ts
init_gcs_storage();
function runIdFromProcessingMarker(objectName) {
  const prefix = (process.env.GCS_PROCESSING_REQUEST_PREFIX ?? "processing-requests/").replace(/^\/+/, "").replace(/\/*$/, "/");
  if (!objectName.startsWith(prefix) || !objectName.endsWith(".json")) return null;
  const runId = objectName.slice(prefix.length, -".json".length);
  return /^run-[0-9a-f-]{36}$/i.test(runId) ? runId : null;
}

// processor/server.ts
function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}
function authorizedInternalRequest(request) {
  const expected = process.env.HELP_REVIEW_WORKER_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  const actual = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
async function readJson(request, limit = 64 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > limit) throw new Error("Request body exceeds the processor limit.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function eventEnvelope(request, body) {
  const candidate = body;
  return {
    eventId: String(request.headers["ce-id"] ?? candidate.id ?? "") || null,
    data: candidate.data && typeof candidate.data === "object" ? candidate.data : candidate
  };
}
async function processEvent(request, response) {
  const event = eventEnvelope(request, await readJson(request));
  const expectedBucket = configuredGcsBucket();
  if (!event.data.name || event.data.bucket !== expectedBucket) {
    response.writeHead(204).end();
    return;
  }
  const runId = runIdFromProcessingMarker(event.data.name);
  if (!runId) {
    response.writeHead(204).end();
    return;
  }
  const trigger = {
    eventId: event.eventId,
    objectGeneration: event.data.generation ?? null,
    retryDelivery: true
  };
  const result = await processRunById(runId, trigger);
  if (result.disposition === "IN_PROGRESS") {
    json(response, 503, { retry: true });
    return;
  }
  response.writeHead(204).end();
}
async function route(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "GET" && url.pathname === "/healthz") {
    json(response, 200, { ok: true, service: "help-review-processor" });
    return;
  }
  if (request.method === "POST" && url.pathname === "/events/storage") {
    await processEvent(request, response);
    return;
  }
  const internalMatch = request.method === "POST" ? url.pathname.match(/^\/internal\/process\/(run-[0-9a-f-]{36})$/i) : null;
  if (internalMatch) {
    if (!authorizedInternalRequest(request)) {
      json(response, 401, { error: "Unauthorized." });
      return;
    }
    response.writeHead(202, { "Cache-Control": "no-store" }).end();
    void processRunById(internalMatch[1]).catch((error) => {
      console.error(JSON.stringify({
        event: "help_review_local_processor_failure",
        runId: internalMatch[1],
        message: error instanceof Error ? error.message : "Unknown processor failure"
      }));
    });
    return;
  }
  json(response, 404, { error: "Not found." });
}
function createProcessorServer() {
  process.env.HELP_REVIEW_SERVICE_ROLE = "processor";
  return createServer((request, response) => {
    void route(request, response).catch((error) => {
      const retryable = error instanceof RetryableProcessingError;
      console.error(JSON.stringify({
        event: "help_review_processor_request_failure",
        retryable,
        safeCode: retryable ? error.safeCode : "PROCESSOR_REQUEST_FAILED"
      }));
      if (!response.headersSent) json(response, retryable ? 503 : 500, { retry: retryable });
      else response.end();
    });
  });
}
if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? process.env.HELP_REVIEW_PROCESSOR_PORT ?? 8081);
  const server = createProcessorServer();
  server.listen(port, "0.0.0.0", () => {
    console.info(JSON.stringify({ event: "help_review_processor_started", port }));
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
export {
  createProcessorServer
};
