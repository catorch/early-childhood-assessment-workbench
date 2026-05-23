export type StoredVideoFile = {
  filename: string;
  fileUrl: string;
  contentType: string;
  bytes: number;
};

export type VideoStorageAdapter = {
  register(input: StoredVideoFile): Promise<StoredVideoFile>;
};

export const localMockStorage: VideoStorageAdapter = {
  async register(input) {
    return input;
  }
};

export function getVideoStorageAdapter(): VideoStorageAdapter {
  return localMockStorage;
}
