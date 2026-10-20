import type { MemoryKind } from "shared";

export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  fact: "Fact",
  "dead-end": "Dead end",
  idea: "Idea",
};

export const MEMORY_KIND_COLORS = {
  fact: "success",
  "dead-end": "danger",
  idea: "accent",
} as const satisfies Record<MemoryKind, string>;

export const MEMORY_KIND_IDS = Object.keys(MEMORY_KIND_LABELS) as MemoryKind[];
