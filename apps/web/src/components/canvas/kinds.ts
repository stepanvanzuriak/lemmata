import type {
  BasePayload,
  CanvasNode,
  CardRun,
  LiteraturePayload,
  NodeKind,
  PaperPayload,
  Resolved,
} from "shared";

export type CardFields = Partial<BasePayload> & {
  label?: string;
  status?: string;
  source?: string;
  python?: string;
  lean?: string;
  run?: CardRun;
  resolved?: Resolved | null;
};

export const fieldsOf = (node: CanvasNode) => node.payload as CardFields;

export const literatureOf = (node: CanvasNode) =>
  node.payload as Partial<LiteraturePayload>;

export const paperOf = (node: CanvasNode) =>
  node.payload as Partial<PaperPayload>;

export const isArchived = (node: CanvasNode) =>
  Boolean(fieldsOf(node).archived);

export const KIND_LABELS: Record<NodeKind, string> = {
  goal: "Goal",
  hypothesis: "Hypothesis",
  attack: "Attack",
  statement: "Statement",
  note: "Note",
  memory: "Memory",
  arxiv: "arXiv",
  literature: "Literature",
  python: "Python",
  lean: "Lean",
  toolbox: "Toolbox",
};

export const CREATABLE_KINDS = [
  "statement",
  "hypothesis",
  "attack",
  "python",
  "lean",
  "toolbox",
  "note",
] as const satisfies readonly NodeKind[];

export type CreatableKind = (typeof CREATABLE_KINDS)[number];

/** Archived cards grouped by the run that archived them; `null` holds the rest. */
export function archivedByRun(nodes: CanvasNode[]) {
  const groups = new Map<string | null, number>();

  for (const node of nodes) {
    const archived = fieldsOf(node).archived;

    if (archived) {
      const by = archived.by ?? null;
      groups.set(by, (groups.get(by) ?? 0) + 1);
    }
  }
  return groups;
}
