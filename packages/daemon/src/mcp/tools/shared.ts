import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Db } from "core";
import type { Toolchain } from "shared";
import { z } from "zod";
import { ArxivError, type ArxivClient } from "../../arxiv/arxiv.js";
import { findCard } from "../../cards/find.js";
import { loadDetail } from "../../cards/load.js";
import { ToolRefusal, type RunContext } from "../../cards/types.js";

export type ToolDeps = {
  db: Db;
  workspaceDir: string;
  toolchain: Promise<Toolchain>;
  arxiv: ArxivClient;
};

export type ToolContext = ToolDeps & {
  run: RunContext;
  detail: () => ReturnType<typeof loadDetail>;
  find: (ref: string) => Promise<{
    card: NonNullable<ReturnType<typeof findCard>>;
    current: Awaited<ReturnType<typeof loadDetail>>;
  }>;
};

export type RegisterTool = (server: McpServer, ctx: ToolContext) => void;

export const text = (value: string): CallToolResult => ({
  content: [{ type: "text", text: value }],
});

export async function guardResult(
  work: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await work();
  } catch (error) {
    const message =
      error instanceof ToolRefusal ||
      error instanceof ArxivError ||
      error instanceof Error
        ? error.message
        : String(error);
    return { ...text(message), isError: true };
  }
}

export const guard = (work: () => Promise<string>) =>
  guardResult(async () => text(await work()));

export const cardRef = z
  .string()
  .describe(
    'Card id, "goal", a hypothesis label such as H2, or an exact title',
  );

export const cardFields = {
  title: z
    .string()
    .optional()
    .describe("Short; math in $...$ as everywhere, e.g. $f_k(n) = o(n^2)$"),
  text: z
    .string()
    .optional()
    .describe("One or two sentences shown on the card"),
  markdown: z
    .string()
    .optional()
    .describe("Full body; math in $...$ or $$...$$"),
  label: z.string().optional().describe("Hypothesis label such as H3"),
  source: z.string().optional().describe("Code for python and lean cards"),
  python: z
    .string()
    .optional()
    .describe("Reusable Python snippet in a toolbox card"),
  lean: z
    .string()
    .optional()
    .describe("Reusable Lean snippet in a toolbox card"),
};
