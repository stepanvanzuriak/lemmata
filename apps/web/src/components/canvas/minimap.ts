import type { CardFlowNode } from "./cards/CardNode";

export function minimapColor(node: CardFlowNode) {
  return `color-mix(in srgb, ${baseColor(node)}, var(--color-lm-ink) 22%)`;
}

function baseColor({ data }: CardFlowNode) {
  const tone = data.status?.tone;
  if (tone && tone !== "idle") {
    return `var(--color-lm-tint-${tone})`;
  }

  switch (data.node.kind) {
    case "note":
      return "var(--color-lm-note)";
    case "toolbox":
    case "python":
      return "var(--color-lm-teal-soft)";
    case "goal":
    case "hypothesis":
      return "var(--color-lm-accent-soft)";
    default:
      return "var(--color-lm-chip)";
  }
}
