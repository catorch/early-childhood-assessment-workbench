import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { StoredVideo } from "./models";
import type { ScoringMedia } from "./scoring-contract";
import { configuredGcsBucket, inspectGcsObject, sha256GcsObject } from "./gcs-storage";
import { uploadDirectory } from "./server-store";

export interface VideoStorage {
  readonly name: string;
  readForScoring(video: StoredVideo): Promise<ScoringMedia>;
  checksum(video: StoredVideo): Promise<string>;
}

function mediaType(video: StoredVideo): ScoringMedia["contentType"] {
  if (["video/mp4", "video/webm", "video/quicktime"].includes(video.contentType)) {
    return video.contentType as ScoringMedia["contentType"];
  }
  throw new Error("The stored video type is not supported by the scoring contract.");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export class LocalVideoStorage implements VideoStorage {
  readonly name = "local";

  async readForScoring(video: StoredVideo): Promise<ScoringMedia> {
    const bytes = await readFile(path.join(uploadDirectory(), path.basename(video.storageKey)));
    if (bytes.byteLength !== video.byteSize) {
      throw new Error("The private video object size does not match its verified metadata.");
    }
    return { kind: "bytes", bytes, contentType: mediaType(video) };
  }

  async checksum(video: StoredVideo): Promise<string> {
    const media = await this.readForScoring(video);
    if (media.kind !== "bytes") throw new Error("The local video bytes are unavailable.");
    return sha256(media.bytes);
  }
}

export class VercelBlobVideoStorage implements VideoStorage {
  readonly name = "vercel-blob";

  async readForScoring(video: StoredVideo): Promise<ScoringMedia> {
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

  async checksum(video: StoredVideo): Promise<string> {
    const media = await this.readForScoring(video);
    if (media.kind !== "bytes") throw new Error("The private Blob video bytes are unavailable.");
    return sha256(media.bytes);
  }
}

export class GcsVideoStorage implements VideoStorage {
  readonly name = "gcs";

  async readForScoring(video: StoredVideo): Promise<ScoringMedia> {
    const bucket = video.storageBucket ?? configuredGcsBucket();
    const object = await inspectGcsObject(video.storageKey, video.storageGeneration, bucket);
    if (
      object.byteSize !== video.byteSize ||
      object.contentType !== video.contentType ||
      (video.checksumCrc32c && object.crc32c !== video.checksumCrc32c)
    ) {
      throw new Error("The private Google Cloud video object does not match its verified metadata.");
    }
    return {
      kind: "gcs",
      uri: `gs://${bucket}/${video.storageKey}`,
      contentType: mediaType(video),
      generation: object.generation
    };
  }

  async checksum(video: StoredVideo): Promise<string> {
    return video.checksumSha256 ?? sha256GcsObject(video);
  }
}

export function selectedVideoStorage(environment: NodeJS.ProcessEnv = process.env): VideoStorage {
  const adapter = environment.HELP_REVIEW_VIDEO_ADAPTER ?? "local";
  if (adapter === "local") return new LocalVideoStorage();
  if (adapter === "vercel-blob") return new VercelBlobVideoStorage();
  if (adapter === "gcs") return new GcsVideoStorage();
  throw new Error(`Unsupported video storage adapter: ${adapter}`);
}
