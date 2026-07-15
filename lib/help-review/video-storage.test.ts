import { createHash } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { StoredVideo } from "./models";
import { uploadDirectory } from "./server-store";
import { LocalVideoStorage, selectedVideoStorage } from "./video-storage";

const storageKey = "video-storage-contract.mp4";
const target = path.join(uploadDirectory(), storageKey);

function video(overrides: Partial<StoredVideo> = {}): StoredVideo {
  return {
    id: "video-storage-contract",
    storageKey,
    originalFilename: "synthetic-observation.mp4",
    contentType: "video/mp4",
    byteSize: 64_256,
    durationSeconds: 3,
    checksumSha256: "4f5b682b4691fe79c416f9d70f8980f84db214b23d613fa4e2274dcebac7d30a",
    uploadedAt: "2026-07-14T14:00:00.000Z",
    uploadedById: "user-educator-1",
    ...overrides
  };
}

describe("private video storage contract", () => {
  beforeEach(async () => {
    await mkdir(uploadDirectory(), { recursive: true });
    await copyFile(path.join(process.cwd(), "tests/fixtures/synthetic-observation.mp4"), target);
  });

  afterEach(async () => {
    await rm(target, { force: true });
  });

  it("reads verified private bytes and calculates their checksum", async () => {
    const storage = new LocalVideoStorage();
    const media = await storage.readForScoring(video());
    expect(media.contentType).toBe("video/mp4");
    expect(media.kind).toBe("bytes");
    if (media.kind !== "bytes") throw new Error("Expected local bytes.");
    expect(media.bytes.byteLength).toBe(64_256);
    await expect(storage.checksum(video())).resolves.toBe(
      createHash("sha256").update(media.bytes).digest("hex")
    );
  });

  it("rejects missing, mismatched, and unsupported stored objects", async () => {
    const storage = new LocalVideoStorage();
    await expect(storage.readForScoring(video({ byteSize: 1 }))).rejects.toThrow("size does not match");
    await expect(storage.readForScoring(video({ storageKey: "missing.mp4" }))).rejects.toThrow();
    await expect(storage.readForScoring(video({ contentType: "text/plain" }))).rejects.toThrow("not supported");
  });

  it("selects one explicit adapter and rejects unknown configuration", () => {
    expect(selectedVideoStorage({ NODE_ENV: "test", HELP_REVIEW_VIDEO_ADAPTER: "local" }).name).toBe("local");
    expect(selectedVideoStorage({ NODE_ENV: "test", HELP_REVIEW_VIDEO_ADAPTER: "vercel-blob" }).name).toBe("vercel-blob");
    expect(selectedVideoStorage({ NODE_ENV: "test", HELP_REVIEW_VIDEO_ADAPTER: "gcs", GCS_VIDEO_BUCKET: "test" }).name).toBe("gcs");
    expect(() => selectedVideoStorage({ NODE_ENV: "test", HELP_REVIEW_VIDEO_ADAPTER: "public-object-store" })).toThrow("Unsupported");
  });
});
