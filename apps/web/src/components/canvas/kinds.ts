import type { BasePayload, CanvasNode, CardRun, NodeKind } from "shared";

export type CardFields = Partial<BasePayload> & {
  label?: string;
  status?: string;
  source?: string;
  run?: CardRun;
};

export const fieldsOf = (node: CanvasNode) => node.payload as CardFields;

export const KIND_LABELS: Record<NodeKind, string> = {
  goal: "Goal",
  hypothesis: "Hypothesis",
  statement: "Statement",
  note: "Note",
  memory: "Memory",
  arxiv: "arXiv",
  python: "Python",
  lean: "Lean",
};

export const CREATABLE_KINDS = [
  "statement",
  "hypothesis",
  "python",
  "lean",
  "note",
] as const satisfies readonly NodeKind[];

export type CreatableKind = (typeof CREATABLE_KINDS)[number];
