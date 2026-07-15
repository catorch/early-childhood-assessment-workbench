import { describe, expect, it } from "vitest";

import { hasExpectedVideoSignature, parseVideoByteRange } from "./video-policy";

describe("video container policy", () => {
  it("accepts MP4/MOV ftyp and WebM EBML signatures", () => {
    const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
    expect(hasExpectedVideoSignature(mp4, "video/mp4")).toBe(true);
    expect(hasExpectedVideoSignature(mp4, "video/quicktime")).toBe(true);
    expect(hasExpectedVideoSignature(webm, "video/webm")).toBe(true);
  });

  it("rejects a renamed non-video payload", () => {
    expect(hasExpectedVideoSignature(new TextEncoder().encode("not a video"), "video/mp4")).toBe(false);
  });

  it("parses one bounded byte range and rejects unsafe forms", () => {
    expect(parseVideoByteRange(null, 100)).toEqual({ start: 0, end: 99, partial: false });
    expect(parseVideoByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19, partial: true });
    expect(parseVideoByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99, partial: true });
    for (const invalid of ["bytes=-10", "bytes=20-10", "bytes=0-100", "bytes=0-1,4-5", `bytes=${"9".repeat(40)}-`]) {
      expect(parseVideoByteRange(invalid, 100)).toBeNull();
    }
  });
});
