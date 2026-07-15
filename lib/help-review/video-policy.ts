export const VIDEO_CONTENT_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_MAX_DURATION_SECONDS = 5 * 60;

export interface VideoByteRange {
  readonly start: number;
  readonly end: number;
  readonly partial: boolean;
}

/** Accepts one explicit HTTP byte range and rejects suffix, multipart, overflow, and out-of-bounds forms. */
export function parseVideoByteRange(range: string | null, byteSize: number): VideoByteRange | null {
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0) return null;
  if (!range) return { start: 0, end: byteSize - 1, partial: false };
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) return null;
  try {
    const startValue = BigInt(match[1]!);
    const endValue = match[2] ? BigInt(match[2]) : BigInt(byteSize - 1);
    if (startValue > BigInt(Number.MAX_SAFE_INTEGER) || endValue > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    const start = Number(startValue);
    const end = Number(endValue);
    if (start > end || end >= byteSize) return null;
    return { start, end, partial: true };
  } catch {
    return null;
  }
}

/** Minimal container signature validation; codecs remain the playback/scoring adapter's concern. */
export function hasExpectedVideoSignature(bytes: Uint8Array, contentType: VideoContentType): boolean {
  if (contentType === "video/webm") {
    return bytes.length >= 4 &&
      bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  return bytes.length >= 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}
