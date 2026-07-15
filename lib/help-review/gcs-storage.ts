import { createHash } from "node:crypto";

import { Storage, type FileMetadata } from "@google-cloud/storage";

import type { StoredVideo } from "./models";
import type { VideoContentType } from "./video-policy";

let sharedStorage: Storage | undefined;

export interface GcsUploadIntent {
  readonly objectName: string;
  readonly contentType: VideoContentType;
  readonly byteSize: number;
  readonly origin: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface VerifiedGcsObject {
  readonly bucket: string;
  readonly objectName: string;
  readonly generation: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly crc32c: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly firstBytes: Uint8Array;
}

export function googleCloudStorage(): Storage {
  return (sharedStorage ??= new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
  }));
}

export function configuredGcsBucket(environment: NodeJS.ProcessEnv = process.env): string {
  const bucket = environment.GCS_VIDEO_BUCKET?.trim();
  if (!bucket) throw new Error("GCS_VIDEO_BUCKET is required for Google Cloud video storage.");
  return bucket;
}

function generationNumber(generation: string | null | undefined): number | undefined {
  if (!generation) return undefined;
  const parsed = Number(generation);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("The stored Google Cloud object generation is invalid.");
  }
  return parsed;
}

function objectFile(bucket: string, objectName: string, generation?: string | null) {
  return googleCloudStorage().bucket(bucket).file(objectName, {
    generation: generationNumber(generation)
  });
}

export async function createGcsResumableUpload(intent: GcsUploadIntent): Promise<string> {
  const bucket = configuredGcsBucket();
  const file = objectFile(bucket, intent.objectName);
  const [sessionUrl] = await file.createResumableUpload({
    origin: intent.origin,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      cacheControl: "private, no-store",
      contentLength: intent.byteSize,
      contentType: intent.contentType,
      metadata: { ...intent.metadata }
    }
  });
  return sessionUrl;
}

function customMetadata(metadata: FileMetadata): Readonly<Record<string, string>> {
  const source = metadata.metadata;
  if (!source || typeof source !== "object") return {};
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

export async function inspectGcsObject(
  objectName: string,
  expectedGeneration?: string | null,
  bucket = configuredGcsBucket()
): Promise<VerifiedGcsObject> {
  const file = objectFile(bucket, objectName, expectedGeneration);
  const [metadata] = await file.getMetadata();
  const generation = String(metadata.generation ?? "");
  if (!generation || (expectedGeneration && generation !== expectedGeneration)) {
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

export async function deleteGcsObject(
  objectName: string,
  bucket = configuredGcsBucket(),
  generation?: string | null
): Promise<void> {
  await objectFile(bucket, objectName, generation).delete({ ignoreNotFound: true });
}

export async function signedGcsPlaybackUrl(video: StoredVideo, lifetimeSeconds = 5 * 60): Promise<string> {
  const bucket = video.storageBucket ?? configuredGcsBucket();
  const file = objectFile(bucket, video.storageKey, video.storageGeneration);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + lifetimeSeconds * 1_000,
    responseType: video.contentType
  });
  return url;
}

export async function sha256GcsObject(video: StoredVideo): Promise<string> {
  const bucket = video.storageBucket ?? configuredGcsBucket();
  const [bytes] = await objectFile(bucket, video.storageKey, video.storageGeneration).download();
  return createHash("sha256").update(bytes).digest("hex");
}
