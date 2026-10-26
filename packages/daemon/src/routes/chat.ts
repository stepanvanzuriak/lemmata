import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import {
  addAgent,
  AGENT_ROLES,
  listAgents,
  listMessages,
  removeAgent,
  updateAgent,
} from "core";
import { ConflictError } from "../agents.js";
import {
  abortRuns,
  activeRuns,
  CanvasNotFound,
  startChat,
  type ChatDeps,
} from "../chat.js";
import { validate } from "../validate.js";
import { enabledModels } from "../providers.js";
import { readSettings } from "./settings.js";

const chatSchema = z.object({
  text: z.string().trim().min(1),
  model: z.string().trim().min(1).nullish(),
});

const agentSchema = z.object({
  role: z.enum(AGENT_ROLES),
  model: z.string().trim().min(1).nullish(),
  tokenCap: z.number().int().positive().nullish(),
});

const agentPatchSchema = agentSchema.omit({ role: true });

/** Mounted at `/api`. */
export function chatRoutes(deps: ChatDeps) {
  const { db } = deps;

  return new Hono()
    .post("/canvases/:id/chat", validate("json", chatSchema), async (c) => {
      let run: Awaited<ReturnType<typeof startChat>>;

      try {
        run = await startChat(deps, c.req.param("id"), c.req.valid("json"));
      } catch (error) {
        if (error instanceof ConflictError) {
          return c.json({ error: error.message, code: error.code }, 409);
        }
        if (error instanceof CanvasNotFound) {
          return c.json({ error: "canvas not found" }, 404);
        }
        throw error;
      }

      return streamSSE(c, async (stream) => {
        await run(async (event) => {
          // The run keeps going if the client disconnects; history and cards are saved anyway.
          await stream
            .writeSSE({ event: event.type, data: JSON.stringify(event) })
            .catch(() => {});
        });
      });
    })
    .post("/canvases/:id/chat/abort", (c) =>
      c.json({ aborted: abortRuns(c.req.param("id"), c.req.query("agent")) }),
    )
    .get("/models", async (c) =>
      c.json(
        deps.adapter
          ? await deps.adapter().models
          : await enabledModels(await readSettings(deps.workspaceDir)),
      ),
    )
    .get("/canvases/:id/runs", (c) => c.json(activeRuns(c.req.param("id"))))
    .get("/canvases/:id/messages", async (c) =>
      c.json(await listMessages(db, c.req.param("id"))),
    )
    .get("/canvases/:id/agents", async (c) =>
      c.json(await listAgents(db, c.req.param("id"))),
    )
    .post("/canvases/:id/agents", validate("json", agentSchema), async (c) => {
      const canvasId = c.req.param("id");
      const input = c.req.valid("json");
      const existing = await listAgents(db, canvasId);

      if (existing.some((a) => a.role === input.role)) {
        return c.json(
          { error: `This canvas already has a ${input.role}.`, code: "exists" },
          409,
        );
      }

      return c.json(await addAgent(db, { canvasId, ...input }), 201);
    })
    .patch(
      "/canvases/:id/agents/:agentId",
      validate("json", agentPatchSchema),
      async (c) => {
        const agent = await updateAgent(
          db,
          c.req.param("agentId"),
          c.req.valid("json"),
        );

        if (!agent) {
          return c.json({ error: "agent not found" }, 404);
        }
        return c.json(agent, 200);
      },
    )
    .delete("/canvases/:id/agents/:agentId", async (c) => {
      const agent = await removeAgent(
        db,
        c.req.param("id"),
        c.req.param("agentId"),
      );

      if (!agent) {
        return c.json({ error: "agent not found" }, 404);
      }
      return c.json(agent, 200);
    });
}
