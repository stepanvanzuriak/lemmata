import { cardStatus, type CanvasDetail, type CanvasNode } from "shared";
import { fieldsOf, isArchived } from "./types.js";

/** Prover runs in a row without any card being settled before a run must review the strategy first. */
export const STALL_RUNS = 12;

/** Runs without progress an attack gets before it must finish, be failed at its blocking step, or split that step off. */
export const ATTACK_RUN_BUDGET = 3;

/** Past this many steps below the goal, a new sub-hypothesis needs a stronger case for being easier. */
export const DEEP_CHAIN = 4;

const REVIEW_TITLE = "Strategy review";

const SETTLED = new Set([
  "proved",
  "disproved",
  "supported",
  "refuted",
  "worked",
]);

const nameOf = (card: CanvasNode) => {
  if (card.kind === "goal") {
    return "goal";
  }
  const { label, title } = fieldsOf(card);
  return label ? `${label} "${title ?? card.id}"` : `"${title ?? card.id}"`;
};

/**
 * The shortest chain of live depends-on links from the goal down to the card,
 * goal first. Empty when the card does not hang from the goal.
 */
export function ancestry(detail: CanvasDetail, card: CanvasNode): CanvasNode[] {
  const byId = new Map(
    detail.nodes.filter((n) => !isArchived(n)).map((n) => [n.id, n]),
  );
  const parents = new Map<string, string[]>();

  for (const edge of detail.edges) {
    if (edge.kind === "depends-on" || edge.kind === "refuted-by") {
      parents.set(edge.toNode, [
        ...(parents.get(edge.toNode) ?? []),
        edge.fromNode,
      ]);
    }
  }

  const cameFrom = new Map<string, string | null>([[card.id, null]]);
  const queue = [card.id];

  while (queue.length > 0) {
    const id = queue.shift()!;

    if (byId.get(id)?.kind === "goal") {
      const chain: CanvasNode[] = [];
      for (let at: string | null = id; at; at = cameFrom.get(at) ?? null) {
        chain.push(byId.get(at)!);
      }
      return chain;
    }
    for (const parent of parents.get(id) ?? []) {
      if (byId.has(parent) && !cameFrom.has(parent)) {
        cameFrom.set(parent, id);
        queue.push(parent);
      }
    }
  }
  return [];
}

const latest = (times: (string | undefined)[]) =>
  times.reduce<string | undefined>(
    (a, b) => (!a || (b && b > a) ? b : a),
    undefined,
  );

/**
 * When a card on the canvas last moved to a settled status. Archived cards count:
 * archiving (a reset, say) does not undo progress. On canvases from before
 * settledAt existed, settled cards fall back to their creation time (an edit
 * bumps updatedAt, so it would hide a stall), and a canvas with nothing settled
 * to the goal's creation.
 */
export function lastProgressAt(detail: CanvasDetail): string | undefined {
  const stamped = detail.nodes.flatMap((n) => fieldsOf(n).settledAt ?? []);
  const legacy = detail.nodes.filter((n) => {
    const { status } = fieldsOf(n);
    return status !== undefined && SETTLED.has(status);
  });

  return (
    latest(stamped) ??
    latest(legacy.map((n) => n.createdAt)) ??
    detail.nodes.find((n) => n.kind === "goal")?.createdAt
  );
}

/**
 * Prover runs since the canvas last moved on: a card was settled, the canvas was
 * reset (a deliberate fresh start), or a strategy review was written.
 */
export function stalledProverRuns(
  detail: CanvasDetail,
  attempts: AttemptLike[],
) {
  const since = latest([
    lastProgressAt(detail),
    ...attempts
      .filter((a) => a.title.startsWith("/reset"))
      .map((a) => a.startedAt),
    ...detail.nodes
      .filter((n) => n.kind === "note" && fieldsOf(n).title === REVIEW_TITLE)
      .map((n) => n.updatedAt),
  ]);

  return attempts.filter(
    (a) => a.title.startsWith("/prover") && (!since || a.startedAt > since),
  ).length;
}

type AttemptLike = { title: string; startedAt: string };

const PROVER_REF = /^\/prover\s+(\S+)/;

/** Earlier prover runs aimed at this card, by id or label, since it was created (or since a later time). */
export function runsOn(
  card: CanvasNode,
  attempts: AttemptLike[],
  since = card.createdAt,
) {
  const label = fieldsOf(card).label?.toLowerCase();

  return attempts.filter((a) => {
    const ref = a.title.match(PROVER_REF)?.[1]?.toLowerCase();
    return (
      ref !== undefined &&
      (ref === card.id.toLowerCase() || ref === label) &&
      a.startedAt >= since
    );
  }).length;
}

/**
 * When an attack last moved forward: its progress record gained an established
 * result, a check linked to it last passed, or a card linked to it was settled
 * (a sub-hypothesis it split off, say). Its creation otherwise.
 */
export function attackProgressAt(detail: CanvasDetail, attack: CanvasNode) {
  const linked = new Set(
    detail.edges.flatMap((e) =>
      e.fromNode === attack.id
        ? [e.toNode]
        : e.toNode === attack.id
          ? [e.fromNode]
          : [],
    ),
  );
  const times = detail.nodes
    .filter((n) => linked.has(n.id))
    .flatMap((n) => {
      const { settledAt } = fieldsOf(n);
      const run = (n.payload as { run?: { runAt?: string } }).run;
      const passed =
        (n.kind === "python" || n.kind === "lean") &&
        cardStatus(n, detail)?.tone === "ok";
      return [settledAt, passed ? run?.runAt : undefined];
    });

  return latest([
    attack.createdAt,
    fieldsOf(attack).progress?.advancedAt,
    ...times,
  ])!;
}

// Cards from before the progress record kept it as a markdown section.
const hasProgress = (card: CanvasNode) =>
  Boolean(fieldsOf(card).progress) ||
  /^#{1,3}\s*Progress\b/im.test(fieldsOf(card).markdown ?? "");

function attackContext(
  detail: CanvasDetail,
  target: CanvasNode,
  attempts: AttemptLike[],
  steered: boolean,
): string[] {
  if (target.kind === "attack") {
    const runs = runsOn(target, attempts);
    const stale = runsOn(target, attempts, attackProgressAt(detail, target));
    const lines =
      runs > 0
        ? [
            `This attack has had ${runs} earlier run${runs === 1 ? "" : "s"}, ${stale} of them since it last gained an established result.${hasProgress(target) ? " Continue from its progress record." : " It has no progress record yet; add one with update_progress this run."}`,
          ]
        : [];
    // A request with its own instructions is the user steering the attack: new
    // information, so the budget does not cut it short.
    if (stale >= ATTACK_RUN_BUDGET && !steered) {
      lines.push(
        `Its run budget is spent: ${stale} runs without a new established result. In this run finish it; or mark it failed with the blocking step as the obstruction; or, if that step is a lemma easier than the hypothesis, create it as a sub-hypothesis of the hypothesis (with an "Easier because" line) and mark this attack failed, pointing to it.`,
      );
    }
    return lines;
  }
  if (target.kind !== "hypothesis") {
    return [];
  }
  const open = detail.edges
    .filter((e) => e.fromNode === target.id)
    .map((e) => detail.nodes.find((n) => n.id === e.toNode))
    .filter(
      (n): n is CanvasNode =>
        n?.kind === "attack" &&
        !isArchived(n) &&
        ["open", "claimed"].includes(fieldsOf(n).status ?? "open"),
    );

  if (open.length === 0) {
    return [];
  }
  const listed = open.map((a) => {
    const runs = runsOn(a, attempts);
    const notes = [
      `${runs} run${runs === 1 ? "" : "s"}`,
      ...(hasProgress(a) ? ["has progress"] : []),
    ];
    return `${nameOf(a)} (${notes.join(", ")})`;
  });
  return [
    `Open attacks on this hypothesis: ${listed.join("; ")}. Continue one of these rather than proposing another, unless the request asks for a different route or they are blocked.`,
  ];
}

export const STRATEGY_REVIEW = (runs: number) =>
  `Strategy review required. ${runs} prover runs have passed since anything on this canvas was last settled, so attacking the target again is unlikely to help. Explicit instructions in the request come first; otherwise do this instead of new attacks:
- Walk the chain from the goal to the target. For each step, say in one line whether the child claim is genuinely easier than its parent (a special case, a known technique applies, or the gap is smaller), or whether it is as hard or harder, such as a known open problem or a new incidence theorem. Use search_literature when unsure.
- Find the highest step where the descent stopped paying off. Record the review in one note titled "${REVIEW_TITLE}", linked from the goal with depends-on; update it if it exists instead of adding another.
- Propose at most two alternative routes at or above that step, each as an attack on the hypothesis it targets, with a one-line case for why it is easier than the current route. If the current route is still the best, say why in the note and name the single smallest step that would settle a card.
- Do not create sub-hypotheses below the target in this run.`;

/** Context for a prover run: where the target sits below the goal, and a review when work has stalled. */
export function frontierContext(
  detail: CanvasDetail,
  target: CanvasNode | undefined,
  stalledRuns: number,
  attempts: AttemptLike[] = [],
  /** The request adds instructions of its own beyond naming the target. */
  steered = false,
): string | null {
  const lines: string[] = [];
  const chain = target ? ancestry(detail, target) : [];

  if (chain.length > 1) {
    const depth = chain.length - 1;
    lines.push(
      `Path from the goal to the target (${depth} step${depth === 1 ? "" : "s"}): ${chain.map(nameOf).join(" → ")}.`,
    );
    if (depth >= DEEP_CHAIN) {
      lines.push(
        `The target is ${depth} steps below the goal. Before adding anything deeper, check that it is still easier than the claims above it; if it is not, say so on the target and propose a route higher up.`,
      );
    }
  }
  if (target) {
    lines.push(...attackContext(detail, target, attempts, steered));
  }
  // An attack the user asked to carry out is run, not reviewed away.
  if (stalledRuns >= STALL_RUNS && target?.kind !== "attack") {
    lines.push(STRATEGY_REVIEW(stalledRuns));
  }
  return lines.length > 0 ? lines.join("\n\n") : null;
}
