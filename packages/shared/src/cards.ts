export type NodeKind =
  | "goal"
  | "hypothesis"
  | "statement"
  | "note"
  | "memory"
  | "arxiv"
  | "python"
  | "lean";

export type BasePayload = {
  title: string;
  text?: string;
  markdown?: string;
  author?: string;
};

export type GoalPayload = BasePayload & {
  kind: "goal";
  status: "open" | "proved" | "disproved";
};

export type HypothesisPayload = BasePayload & {
  kind: "hypothesis";
  label: string;
  status: "open" | "supported" | "refuted";
};

export type CodePayload = BasePayload & {
  kind: "python" | "lean";
  source: string;
};

export type PlainPayload = BasePayload & {
  kind: "statement" | "note" | "memory" | "arxiv";
};

export type NodePayload =
  GoalPayload | HypothesisPayload | CodePayload | PlainPayload;
