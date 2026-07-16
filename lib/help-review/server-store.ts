/** Shared state repository with a local file fallback and a Neon demo adapter. */

import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { createSanitizedPilotState } from "./fixtures";
import type { PilotState } from "./models";
import { assertRuntimeConfiguration } from "./runtime-config";

const dataDirectory = path.join(process.cwd(), ".data");
const statePath = path.join(dataDirectory, "pilot-state.json");
const stateLockPath = path.join(dataDirectory, "pilot-state.lock");
let writeQueue: Promise<void> = Promise.resolve();

async function pause(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withLocalStateLock<T>(operation: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 15_000;
  while (true) {
    try {
      await mkdir(stateLockPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const metadata = await stat(stateLockPath);
        if (Date.now() - metadata.mtimeMs > 60_000) {
          await rm(stateLockPath, { recursive: true, force: true });
          continue;
        }
      } catch (metadataError) {
        if ((metadataError as NodeJS.ErrnoException).code !== "ENOENT") throw metadataError;
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

async function ensureState(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(statePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(statePath, JSON.stringify(createSanitizedPilotState(), null, 2), "utf8");
  }
}

/** Reads the current sanitized state; invalid first-party state fails loudly. */
export async function readPilotState(): Promise<PilotState> {
  assertRuntimeConfiguration();
  if (["neon", "pg"].includes(process.env.HELP_REVIEW_STATE_ADAPTER ?? "")) {
    const { readNeonPilotState } = await import("./neon-store");
    return readNeonPilotState();
  }
  await ensureState();
  const raw = await readFile(statePath, "utf8");
  const parsed = JSON.parse(raw) as PilotState;
  if (parsed.fixtureVersion !== 1 || !Array.isArray(parsed.users) || !Array.isArray(parsed.assessments)) {
    throw new Error("The local pilot state has an unsupported shape.");
  }
  parsed.supportEvents ??= [];
  parsed.videoAccessGrants ??= [];
  parsed.credentials ??= [];
  parsed.authTokens ??= [];
  for (const admin of parsed.users.filter((user) => user.role === "ADMIN")) {
    if (!parsed.access.some((provision) => provision.userId === admin.id)) {
      parsed.access.push({
        id: `access-${admin.id}`,
        exactEmail: admin.email,
        userId: admin.id,
        role: "ADMIN",
        active: admin.isActive,
        updatedAt: new Date().toISOString(),
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

/** Serializes a state update and atomically replaces the local fixture file. */
export async function updatePilotState<T>(mutation: (state: PilotState) => T | Promise<T>): Promise<T> {
  assertRuntimeConfiguration();
  if (["neon", "pg"].includes(process.env.HELP_REVIEW_STATE_ADAPTER ?? "")) {
    const { updateNeonPilotState } = await import("./neon-store");
    return updateNeonPilotState(mutation);
  }
  let result!: T;
  const operation = writeQueue.then(() => withLocalStateLock(async () => {
      const state = await readPilotState();
      result = await mutation(state);
      const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
      await rename(temporaryPath, statePath);
    }));
  writeQueue = operation.catch(() => undefined);
  await operation;
  return result;
}

export function uploadDirectory(): string {
  return path.join(dataDirectory, "uploads");
}

export async function removePilotUpload(storageKey: string): Promise<void> {
  if (process.env.HELP_REVIEW_VIDEO_ADAPTER === "gcs") {
    const { deleteGcsObject } = await import("./gcs-storage");
    await deleteGcsObject(storageKey);
    return;
  }
  if (process.env.HELP_REVIEW_VIDEO_ADAPTER === "vercel-blob") {
    const { del } = await import("@vercel/blob");
    await del(storageKey);
    return;
  }
  await rm(path.join(uploadDirectory(), path.basename(storageKey)), { force: true });
}

/** Resets sanitized local state without touching uploaded files. Never exposed in production. */
export async function resetPilotState(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Sandbox reset is disabled in production.");
  await mkdir(dataDirectory, { recursive: true });
  await withLocalStateLock(async () => {
    const temporaryPath = `${statePath}.${process.pid}.reset.tmp`;
    await writeFile(temporaryPath, JSON.stringify(createSanitizedPilotState(), null, 2), "utf8");
    await rename(temporaryPath, statePath);
  });
}
