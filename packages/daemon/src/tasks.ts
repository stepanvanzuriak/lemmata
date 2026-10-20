import type { CanvasNode } from "shared";
import { fieldsOf } from "./cards/types.js";

export type TaskRole = "literature" | "curator" | "reset";

export type Task = {
  role: TaskRole;
  ref: string;
  instructions: string;
};

const LITERATURE = /^\/literature\s+(\S+)\s*([\s\S]*)$/;
const TIDY = /^\/tidy\b\s*([\s\S]*)$/;
const RESET = /^\/reset\b\s*([\s\S]*)$/;

export function parseTask(text: string): Task | null {
  const trimmed = text.trim();
  const literature = trimmed.match(LITERATURE);

  if (literature) {
    return {
      role: "literature",
      ref: literature[1]!,
      instructions: literature[2]!.trim(),
    };
  }

  const tidy = trimmed.match(TIDY);

  if (tidy) {
    return { role: "curator", ref: "goal", instructions: tidy[1]!.trim() };
  }

  const reset = trimmed.match(RESET);

  if (reset) {
    return { role: "reset", ref: "goal", instructions: reset[1]!.trim() };
  }
  return null;
}

const describe = (card: CanvasNode) => {
  const { label, title } = fieldsOf(card);
  return `${card.kind}${label ? ` ${label}` : ""} "${title ?? card.id}" (id ${card.id})`;
};

export function taskPrompt(
  task: Task,
  target: CanvasNode,
  literatureCard?: CanvasNode,
) {
  const prompts: Record<TaskRole, string> = {
    literature: `Check the literature for ${describe(target)}. Record the result on the literature card ${literatureCard?.id} with record_literature.`,
    curator:
      "Tidy this canvas: merge the notes on each hypothesis into one summary, archive dead ends, and write the Canvas summary.",
    reset:
      "Reset this canvas to its key points: write the few cards a fresh start needs. When you finish, every other card is archived.",
  };
  const prompt = prompts[task.role];

  if (!task.instructions) {
    return prompt;
  }
  return `${prompt}\n\nUser instructions: ${task.instructions}`;
}
