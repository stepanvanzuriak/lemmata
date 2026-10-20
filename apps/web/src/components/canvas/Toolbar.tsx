import type { ReactNode } from "react";
import { Button, Toolbar as ToolbarRoot, Tooltip } from "@heroui/react";
import clsx from "clsx";
import {
  BookOpen,
  ArrowRotateLeft,
  BroomMotion,
  LayoutCellsLarge,
  Sticker,
} from "@gravity-ui/icons";
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

function ActionButton({
  label,
  hint,
  onPress,
  isDisabled,
  className,
  children,
}: {
  label: string;
  hint: string;
  onPress: VoidFunction;
  isDisabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip delay={300}>
      <Button
        isIconOnly
        aria-label={label}
        variant="ghost"
        isDisabled={isDisabled}
        className={clsx("size-11 rounded-lg text-lm-ink2", className)}
        onPress={onPress}
      >
        {children}
      </Button>
      <Tooltip.Content placement="right">{hint}</Tooltip.Content>
    </Tooltip>
  );
}

export function Toolbar({
  onCreate,
  onTidy,
  onCleanup,
  onReset,
  onLiterature,
  isPending,
}: {
  onCreate: (kind: CreatableKind) => void;
  onTidy: VoidFunction;
  onCleanup?: VoidFunction;
  onReset?: VoidFunction;
  onLiterature?: VoidFunction;
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
      <ActionButton
        label="Tidy layout"
        hint="Tidy layout (arranges every card)"
        className="mt-0.5 border-t border-lm-hair"
        onPress={onTidy}
      >
        <LayoutCellsLarge width={18} height={18} aria-hidden="true" />
      </ActionButton>
      <ActionButton
        label="Clean up canvas"
        hint="Clean up: summarize notes per hypothesis and archive dead ends (/tidy)"
        isDisabled={!onCleanup}
        onPress={() => onCleanup?.()}
      >
        <BroomMotion width={18} height={18} aria-hidden="true" />
      </ActionButton>
      <ActionButton
        label="Reset canvas"
        hint="Reset: keep only a few key points and archive everything else (/reset)"
        isDisabled={!onReset}
        onPress={() => onReset?.()}
      >
        <ArrowRotateLeft width={18} height={18} aria-hidden="true" />
      </ActionButton>
      <ActionButton
        label="Check literature"
        hint="Check arXiv for the selected card, or the goal (/literature)"
        isDisabled={!onLiterature}
        onPress={() => onLiterature?.()}
      >
        <BookOpen width={18} height={18} aria-hidden="true" />
      </ActionButton>
    </ToolbarRoot>
  );
}
