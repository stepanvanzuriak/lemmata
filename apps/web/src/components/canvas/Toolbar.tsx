import type { ReactNode } from "react";
import { Button, Toolbar as ToolbarRoot, Tooltip } from "@heroui/react";
import { LayoutCellsLarge, Sticker } from "@gravity-ui/icons";
import type { CreatableKind } from "./kinds";

const TOOLS: { kind: CreatableKind; label: string; icon: ReactNode }[] = [
  {
    kind: "statement",
    label: "Add statement card",
    icon: <span className="font-serif text-lg italic">∀</span>,
  },
  {
    kind: "hypothesis",
    label: "Add hypothesis",
    icon: <span className="text-[17px] font-semibold">H</span>,
  },
  {
    kind: "python",
    label: "Add Python cell",
    icon: <span className="font-mono text-[13px]">py</span>,
  },
  {
    kind: "lean",
    label: "Add Lean check",
    icon: <span className="text-lg">⊢</span>,
  },
  {
    kind: "note",
    label: "Add note",
    icon: <Sticker width={18} height={18} aria-hidden="true" />,
  },
];

export function Toolbar({
  onCreate,
  onTidy,
  isPending,
}: {
  onCreate: (kind: CreatableKind) => void;
  onTidy: VoidFunction;
  isPending?: boolean;
}) {
  return (
    <ToolbarRoot
      aria-label="Canvas tools"
      orientation="vertical"
      className="flex flex-col gap-0.5 rounded-[10px] border border-lm-line bg-lm-surface p-1 shadow-[0_2px_8px_rgba(20,22,26,0.06)]"
    >
      {TOOLS.map(({ kind, label, icon }) => (
        <Tooltip key={kind} delay={300}>
          <Button
            isIconOnly
            aria-label={label}
            variant="ghost"
            isDisabled={isPending}
            className="size-11 rounded-lg text-lm-ink2"
            onPress={() => onCreate(kind)}
          >
            {icon}
          </Button>
          <Tooltip.Content placement="right">{label}</Tooltip.Content>
        </Tooltip>
      ))}
      <Tooltip delay={300}>
        <Button
          isIconOnly
          aria-label="Tidy layout"
          variant="ghost"
          className="mt-0.5 size-11 rounded-lg border-t border-lm-hair text-lm-ink2"
          onPress={onTidy}
        >
          <LayoutCellsLarge width={18} height={18} aria-hidden="true" />
        </Button>
        <Tooltip.Content placement="right">
          Tidy layout (arranges every card)
        </Tooltip.Content>
      </Tooltip>
    </ToolbarRoot>
  );
}
