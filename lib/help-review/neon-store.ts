import { Prisma, type PrismaClient } from "@prisma/client";

import { SkillSuggestionSchema } from "./domain";
import { createSanitizedPilotState } from "./fixtures";
import type { AssessmentContextSnapshot, PilotAssessment, PilotState } from "./models";
import { databaseClient } from "./prisma";

type DatabaseExecutor = Prisma.TransactionClient;

const DATABASE_LOCK_KEY = 7_210_042_026;
let seedPromise: Promise<void> | undefined;

function asExecutor(client: PrismaClient): DatabaseExecutor {
  return client as unknown as DatabaseExecutor;
}

function date(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid pilot timestamp: ${value}`);
  return parsed;
}

function observationDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function contextLabel(value: Prisma.JsonValue | null): string | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const label = (value as Record<string, Prisma.JsonValue>)["label"];
  return typeof label === "string" ? label : null;
}

function supportContext(value: Prisma.JsonValue | null): AssessmentContextSnapshot["supportContext"] | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  const context = (value as Record<string, Prisma.JsonValue>)["supportContext"];
  return ["NONE_REPORTED", "IFSP", "DISABILITY", "IFSP_AND_DISABILITY", "UNKNOWN"].includes(String(context))
    ? context as AssessmentContextSnapshot["supportContext"]
    : undefined;
}

function contextSource(value: Prisma.JsonValue | null): AssessmentContextSnapshot["source"] | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  const source = (value as Record<string, Prisma.JsonValue>)["source"];
  return ["SANITIZED_ADMIN", "ROSTER_ADAPTER"].includes(String(source))
    ? source as AssessmentContextSnapshot["source"]
    : undefined;
}

function assessmentContextSnapshot(value: Prisma.JsonValue | null): AssessmentContextSnapshot | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  const snapshot = value as Record<string, Prisma.JsonValue>;
  const ageMonthsAtObservation = snapshot.ageMonthsAtObservation;
  const supportContext = snapshot.supportContext;
  const context = snapshot.contextLabel;
  const processingAllowedAtCreation = snapshot.processingAllowedAtCreation;
  const capturedAt = snapshot.capturedAt;
  const source = snapshot.source;
  if (
    typeof ageMonthsAtObservation !== "number" ||
    !["NONE_REPORTED", "IFSP", "DISABILITY", "IFSP_AND_DISABILITY", "UNKNOWN"].includes(String(supportContext)) ||
    !(typeof context === "string" || context === null) ||
    typeof processingAllowedAtCreation !== "boolean" ||
    typeof capturedAt !== "string" ||
    !["SANITIZED_ADMIN", "ROSTER_ADAPTER"].includes(String(source))
  ) return undefined;
  return {
    ageMonthsAtObservation,
    supportContext: supportContext as AssessmentContextSnapshot["supportContext"],
    contextLabel: context,
    processingAllowedAtCreation,
    capturedAt,
    source: source as AssessmentContextSnapshot["source"]
  };
}

async function lockState(transaction: DatabaseExecutor): Promise<void> {
  await transaction.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(${DATABASE_LOCK_KEY})`;
}

async function loadState(database: DatabaseExecutor): Promise<PilotState> {
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
    users.filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user])
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
      supportContext: supportContext(child.approvedContext),
      contextSource: contextSource(child.approvedContext),
      processingAllowed: child.processingAllowed === true,
      isActive: child.isActive
    })),
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      educatorId: assignment.educatorId,
      childId: assignment.childId,
      active:
        assignment.revokedAt === null &&
        (assignment.endsAt === null || assignment.endsAt.getTime() > Date.now()),
      updatedAt: assignment.updatedAt.toISOString(),
      updatedById: assignment.createdById
    })),
    assessments: assessments.map((assessment): PilotAssessment => {
      const availableVideo = assessment.videoAssets.find(
        (video) => video.status === "AVAILABLE" && video.deletedAt === null
      );
      const resultRun = [...assessment.processingRuns]
        .reverse()
        .find((run) => run.suggestions.length > 0);
      const suggestions = (resultRun?.suggestions ?? []).map((suggestion) =>
        SkillSuggestionSchema.parse({
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
        video: availableVideo
          ? {
              id: availableVideo.id,
              storageProvider: availableVideo.storageProvider as "local" | "vercel-blob" | "gcs",
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
            }
          : null,
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
        clientRequestId: assessment.clientRequestId ?? undefined,
        finalizationKey: assessment.finalizationKey
      };
    }),
    access: access.flatMap((provision) => {
      const user =
        (provision.externalSubject ? userBySubject.get(provision.externalSubject) : undefined) ??
        (provision.exactEmail ? userByEmail.get(provision.exactEmail.toLowerCase()) : undefined);
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
      assessmentId: event.assessmentId ?? undefined,
      subjectId: event.subjectId ?? undefined,
      referenceId: event.referenceId ?? undefined
    })),
    videoAccessGrants: videoAccessGrants.map((grant) => ({
      id: grant.id,
      assessmentId: grant.assessmentId,
      videoAssetId: grant.videoAssetId,
      viewerId: grant.viewerId,
      purpose: "EDUCATOR_REVIEW" as const,
      issuedAt: grant.issuedAt.toISOString(),
      expiresAt: grant.expiresAt.toISOString()
    }))
  };
}

async function persistState(database: DatabaseExecutor, state: PilotState): Promise<void> {
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
    const approvedContext = child.contextLabel || child.supportContext || child.contextSource
      ? ({
          label: child.contextLabel,
          supportContext: child.supportContext ?? "UNKNOWN",
          source: child.contextSource ?? "SANITIZED_ADMIN"
        } as Prisma.InputJsonValue)
      : Prisma.JsonNull;
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
    const contextSnapshot = assessment.contextSnapshot
      ? (assessment.contextSnapshot as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;
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
        data: { status: "DELETED", deletedAt: new Date() }
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
    const staleSuggestionIds = storedSuggestions
      .map((suggestion) => suggestion.id)
      .filter((id) => !stateSuggestionIds.has(id));
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
          processingRunId: resultRun!.id,
          sourceSkillId: suggestion.sourceSkillId,
          skillCode: suggestion.skillCode,
          skillName: suggestion.skillName,
          domain: suggestion.domain,
          strand: suggestion.strand,
          draftCredit: suggestion.draftCredit,
          confidence: suggestion.confidence,
          uncertaintyReason: suggestion.uncertaintyReason,
          evidence: suggestion.evidence as unknown as Prisma.InputJsonValue,
          sourceOrder: suggestion.sourceOrder
        },
        update: {
          processingRunId: resultRun!.id,
          sourceSkillId: suggestion.sourceSkillId,
          skillCode: suggestion.skillCode,
          skillName: suggestion.skillName,
          domain: suggestion.domain,
          strand: suggestion.strand,
          draftCredit: suggestion.draftCredit,
          confidence: suggestion.confidence,
          uncertaintyReason: suggestion.uncertaintyReason,
          evidence: suggestion.evidence as unknown as Prisma.InputJsonValue,
          sourceOrder: suggestion.sourceOrder
        }
      });
    }

    const stateDecisionIds = new Set(assessment.decisions.map((decision) => decision.suggestionId));
    const storedDecisions = await database.reviewDecision.findMany({
      where: { suggestion: { processingRun: { assessmentId: assessment.id } } },
      select: { suggestionId: true }
    });
    const staleDecisionIds = storedDecisions
      .map((decision) => decision.suggestionId)
      .filter((id) => !stateDecisionIds.has(id));
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

async function seedDatabase(): Promise<void> {
  const prisma = databaseClient();
  await prisma.$transaction(async (transaction) => {
    await lockState(transaction);
    const fixtureExists = await transaction.user.findUnique({
      where: { id: "user-educator-1" },
      select: { id: true }
    });
    if (fixtureExists) return;
    const seedApproved =
      process.env.HELP_REVIEW_SEED_SANITIZED_DATA === "true" || process.env.NODE_ENV !== "production";
    if (!seedApproved) {
      throw new Error(
        "The PostgreSQL database has no sanitized pilot seed. Set HELP_REVIEW_SEED_SANITIZED_DATA=true only for an approved demo."
      );
    }
    await persistState(transaction, createSanitizedPilotState());
  }, { timeout: 30_000 });
}

async function ensureSeed(): Promise<void> {
  seedPromise ??= seedDatabase().catch((error) => {
    seedPromise = undefined;
    throw error;
  });
  await seedPromise;
}

export async function readNeonPilotState(): Promise<PilotState> {
  await ensureSeed();
  return loadState(asExecutor(databaseClient()));
}

/** Applies one legacy state mutation while serializing it in a database transaction. */
export async function updateNeonPilotState<T>(
  mutation: (state: PilotState) => T | Promise<T>
): Promise<T> {
  await ensureSeed();
  return databaseClient().$transaction(async (transaction) => {
    await lockState(transaction);
    const state = await loadState(transaction);
    const result = await mutation(state);
    await persistState(transaction, state);
    return result;
  }, { timeout: 30_000 });
}
