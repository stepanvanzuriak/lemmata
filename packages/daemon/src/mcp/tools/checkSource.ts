import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { z } from "zod";
import { figuresDir, runSource, type RunnableKind } from "../../runCard.js";
import { runResult } from "./runCard.js";
import { guardResult, type RegisterTool } from "./shared.js";

const DESCRIPTIONS: Record<RunnableKind, string> = {
  python:
    "Run draft Python without creating or changing a card: a scratchpad for trying code before it goes on the canvas. Runs exactly like a python card (same interpreter, stripped environment, project dir, `import toolbox` resolves to the canvas toolbox) and returns stdout, stderr and figures. Nothing is saved or shown to the user, so it is not evidence: put a check the argument relies on in a python card and run it with run_card. Stops after 10 minutes; cancel the tool call to stop it early.",
  lean: "Compile draft Lean 4 without creating or changing a card: a scratchpad for iterating on proofs before they go on the canvas. Runs exactly like a lean card (same toolchain and Mathlib, `import Toolbox` resolves to the canvas toolbox) and returns diagnostics, sorry and axioms of the first theorem. Use it instead of running lean or lake in a shell. Nothing is saved or shown to the user, so it is not evidence: put the finished proof in a lean card and run it with run_card. Stops after 20 minutes; cancel the tool call to stop it early.",
};

const registerCheck =
  (kind: RunnableKind): RegisterTool =>
  (server, { db, run, workspaceDir, toolchain }) => {
    server.registerTool(
      `check_${kind}`,
      {
        description: DESCRIPTIONS[kind],
        inputSchema: {
          source: z.string().min(1),
          toolbox: z
            .string()
            .optional()
            .describe(
              `Draft ${kind} toolbox to import instead of the canvas toolbox, to try a toolbox change before saving it with update_card. Omit to use the canvas toolbox.`,
            ),
        },
      },
      ({ source, toolbox }, extra) =>
        guardResult(async () => {
          const key = `check-${randomUUID()}`;
          const dir = figuresDir(workspaceDir, key);

          try {
            const result = await runSource(
              db,
              {
                canvasId: run.canvasId,
                kind,
                source,
                figuresKey: key,
                toolbox,
              },
              { workspaceDir, toolchain, isolated: true, signal: extra.signal },
            );
            return await runResult(result, dir, [
              "Scratch check: not saved to any card.",
            ]);
          } finally {
            await rm(dir, { recursive: true, force: true });
          }
        }),
    );
  };

export const registerCheckPython = registerCheck("python");
export const registerCheckLean = registerCheck("lean");
