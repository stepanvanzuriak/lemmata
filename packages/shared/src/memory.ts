import type { MemoryEntry } from "core/schema";

export type { MemoryEntry };

export type MemoryKind = MemoryEntry["kind"];

export type AddMemoryRequest = { kind: MemoryKind; text: string };

export type UpdateMemoryRequest = Partial<
  AddMemoryRequest & { pinned: boolean }
>;
