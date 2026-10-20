import { settleReady, type CanvasDetail, type CanvasNode } from "shared";
import { fieldsOf, isArchived } from "./types.js";

const nameOf = (card: CanvasNode) =>
  card.kind === "goal"
    ? "the goal"
    : (fieldsOf(card).label ?? `"${fieldsOf(card).title}"`);

const GOAL_STATUS = { supported: "proved", refuted: "disproved" } as const;

/**
 * Tells the agent which parents its change decided: the goal, or a hypothesis whose
 * sub-lemmas are all supported or whose counterexample holds. Null when none are.
 */
export function settleNudge(detail: CanvasDetail): string | null {
  const lines = detail.nodes.flatMap((card) => {
    const ready = !isArchived(card) && settleReady(card, detail);

    if (!ready) {
      return [];
    }

    const status = card.kind === "goal" ? GOAL_STATUS[ready] : ready;
    const ref =
      card.kind === "goal" ? "goal" : (fieldsOf(card).label ?? card.id);
    const why =
      ready === "refuted"
        ? "a refuted-by hypothesis is supported"
        : "every depends-on hypothesis is supported";

    return [
      `- ${nameOf(card)}: ${why}. If the argument holds, set it with update_card({ id: "${ref}", status: "${status}" }).`,
    ];
  });

  if (lines.length === 0) {
    return null;
  }
  return [
    "Next: these cards are now decided by what they link to.",
    ...lines,
  ].join("\n");
}
