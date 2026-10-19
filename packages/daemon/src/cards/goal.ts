import { goalReady, type CanvasDetail } from "shared";

export function goalNudge(detail: CanvasDetail): string | null {
  const goal = detail.nodes.find((n) => n.kind === "goal");
  const ready = goal && goalReady(goal, detail);

  if (!ready) {
    return null;
  }

  return `Next: the hypotheses now decide the goal. Set the goal's status to ${ready} with update_card({ id: "goal", status: "${ready}" }) if the argument holds.`;
}
