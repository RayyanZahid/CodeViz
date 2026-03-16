export const FileEventType = {
  ADDED: 'added',
  MODIFIED: 'modified',
  REMOVED: 'removed',
} as const;
export type FileEventType = typeof FileEventType[keyof typeof FileEventType];

export interface WatchEvent {
  relativePath: string;  // project-relative, forward slashes
  absolutePath: string;  // full OS path
  type: FileEventType;
}

export interface FileWatchBatch {
  events: WatchEvent[];
  sequenceStart: number;  // first monotonic sequence ID in this batch
  flushedAt: number;      // Date.now() when batch was flushed
}
