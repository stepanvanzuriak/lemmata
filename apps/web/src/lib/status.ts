import type { ComponentType, SVGProps } from "react";
import {
  CircleCheck,
  CircleDashed,
  CircleXmark,
  Clock,
  TriangleExclamation,
} from "@gravity-ui/icons";
import type { Tone } from "shared";

export type ToneStyle = {
  tint: string;
  chipColor: "success" | "danger" | "warning" | "accent" | "default";
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const TONES: Record<Tone, ToneStyle> = {
  ok: { tint: "bg-lm-tint-ok", chipColor: "success", Icon: CircleCheck },
  bad: { tint: "bg-lm-tint-bad", chipColor: "danger", Icon: CircleXmark },
  warn: {
    tint: "bg-lm-tint-warn",
    chipColor: "warning",
    Icon: TriangleExclamation,
  },
  work: { tint: "bg-lm-tint-work lm-pulse", chipColor: "accent", Icon: Clock },
  idle: { tint: "bg-lm-surface", chipColor: "default", Icon: CircleDashed },
};
