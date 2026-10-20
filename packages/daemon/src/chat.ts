import {
  addMessage,
  lastSessionId,
  listAgents,
  type CanvasAgent,
  type ChatMessage,
} from "core";
import {
  createAdapter,
  runAttempt,
  type AgentAdapter,
  type RunEvent,
} from "runner";
import type { CanvasDetail, ChatEvent, ChatRequest, RunInfo } from "shared";
import {
  claim,
  ConflictError,
  expandCommand,
  findTarget,
  parseCommand,
  release,
} from "./agents.js";
import { describeCanvas } from "./cards/describe.js";
import { loadDetail } from "./cards/load.js";
import type { Author, RunContext } from "./cards/types.js";
import { memoryPreamble } from "./memory.js";
import { mcpConfigFor, registerRun, unregisterRun } from "./mcp/registry.js";
import type { ToolDeps } from "./mcp/tools.js";
import { ROLE_PROMPTS } from "./roles.js";
import { projectDir } from "./runCard.js";

export const DEFAULT_MAX_TOKENS = 1_000_000;

export type ChatDeps = ToolDeps & {
  port: () => number;
  adapter?: () => AgentAdapter;
};

export type Emit = (event: ChatEvent) => Promise<void>;

const active = new Map<string, Map<string, AbortController>>();

export function activeRuns(canvasId: string): string[] {
  return [...(active.get(canvasId)?.keys() ?? [])];
}

export function abortRuns(canvasId: string, runKey?: string): number {
  const runs = active.get(canvasId);
  const keys = runKey ? [runKey] : [...(runs?.keys() ?? [])];
  let count = 0;

  for (const key of keys) {
    const controller = runs?.get(key);
    if (controller) {
      controller.abort();
      count += 1;
    }
  }
  return count;
}

export class CanvasNotFound extends Error {}

function snapshot(detail: CanvasDetail) {
  return {
    nodes: new Map(detail.nodes.map((n) => [n.id, n.updatedAt])),
    edges: new Set(detail.edges.map((e) => e.id)),
  };
}

function changes(before: ReturnType<typeof snapshot>, after: CanvasDetail) {
  return {
    nodes: after.nodes.filter((n) => before.nodes.get(n.id) !== n.updatedAt),
    edges: after.edges.filter((e) => !before.edges.has(e.id)),
  };
}

const usageTokens = (event: Extract<RunEvent, { type: "usage" }>) =>
  event.usage.input +
  event.usage.output +
  event.usage.cacheRead +
  event.usage.cacheWrite;

export async function startChat(
  deps: ChatDeps,
  canvasId: string,
  request: ChatRequest,
): Promise<(emit: Emit) => Promise<void>> {
  const { db } = deps;
  const canvas = await db.query.canvas.findFirst({
    where: { id: canvasId },
    with: { project: true },
  });

  if (!canvas?.project) {
    throw new CanvasNotFound(`canvas ${canvasId} not found`);
  }

  const detail = await loadDetail(db, canvasId);
  const command = parseCommand(request.text);
  let agent: CanvasAgent | undefined;
  let target: CanvasDetail["nodes"][number] | undefined;

  if (command) {
    agent = (await listAgents(db, canvasId)).find(
      (a) => a.role === command.role,
    );
    target = findTarget(detail, command.ref);

    if (!agent) {
      throw new ConflictError(
        "no_agent",
        `Add a ${command.role} to this canvas first.`,
      );
    }
    if (!target) {
      throw new ConflictError(
        "no_target",
        `No card matches "${command.ref}". Use goal, a label such as H2, or a card id.`,
      );
    }
  }

  const runKey = agent?.id ?? "assistant";
  const runs = active.get(canvasId) ?? new Map<string, AbortController>();

  if (runs.has(runKey)) {
    throw new ConflictError(
      "busy",
      "This agent is already running. Stop it or wait.",
    );
  }

  const controller = new AbortController();
  runs.set(runKey, controller);
  active.set(canvasId, runs);

  const role = agent?.role ?? "assistant";
  const author: Author = agent
    ? { role: agent.role, agentId: agent.id }
    : { role: "assistant" };
  const run: RunInfo = {
    runKey,
    role,
    model: agent?.model ?? request.model ?? null,
    target: target?.id ?? null,
  };
  const project = canvas.project;

  return async (emit) => {
    const adapter = deps.adapter?.() ?? createAdapter("claude");
    const modelId = agent?.model ?? request.model ?? null;
    let secret: string | null = null;
    let seen = snapshot(detail);
    let reply = "";
    let tokens = 0;

    const emitChanges = async () => {
      const current = await loadDetail(db, canvasId);
      const changed = changes(seen, current);
      seen = snapshot(current);

      if (changed.nodes.length > 0 || changed.edges.length > 0) {
        await emit({ type: "cards", ...changed });
      }
    };

    try {
      const userMessage = await addMessage(db, {
        canvasId,
        role: "user",
        text: request.text,
        agentId: agent?.id,
        target: target?.id,
      });
      await emit({ type: "user", message: userMessage, run });

      if (agent && target) {
        await claim(db, target, agent);
        await emitChanges();
      }

      const focus = target ? [target.id] : [];
      const runContext: RunContext = {
        canvasId,
        author,
        target: target?.id,
        focus,
      };
      let memoryReported = 0;
      secret = registerRun(runContext);

      const attempt = await runAttempt(
        {
          db,
          adapter,
          projectId: project.id,
          canvasId,
          title: request.text.slice(0, 80),
          maxTokens: agent?.tokenCap ?? DEFAULT_MAX_TOKENS,
          signal: controller.signal,
          onStart: (started) => {
            runContext.attemptId = started.id;
          },
          options: {
            cwd: await projectDir(db, canvasId, deps.workspaceDir),
            prompt:
              command && target ? expandCommand(command, target) : request.text,
            resumeSessionId:
              (await lastSessionId(
                db,
                canvasId,
                agent?.id ?? null,
                target?.id ?? null,
              )) ?? undefined,
            model: modelId
              ? { provider: adapter.name, id: modelId }
              : undefined,
            systemPromptAddendum: [
              `Project: ${project.title}\n${project.statement}`,
              await memoryPreamble(db, project.id),
              ROLE_PROMPTS[role],
              `Canvas at the start of this run:\n${describeCanvas(detail, author, focus)}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
            mcpServers: mcpConfigFor(secret, deps.port()),
          },
        },
        async (event) => {
          if (event.type === "text") {
            reply += event.text;
            await emit({ type: "text", text: event.text });
          }
          if (event.type === "tool_use") {
            await emit({ type: "tool_use", name: event.name });
          }
          if (event.type === "tool_result") {
            await emitChanges();

            const saved = (runContext.memorySaved ?? 0) - memoryReported;
            if (saved > 0) {
              memoryReported += saved;
              await emit({ type: "memory", saved });
            }
          }
          if (event.type === "usage") {
            tokens += usageTokens(event);
            await emit({ type: "usage", tokens });
          }
          if (event.type === "error") {
            await emit({ type: "error", message: event.message });
          }
        },
      );

      if (attempt.status === "stopped_budget") {
        await emit({
          type: "warning",
          message: "Stopped: the run passed its token cap.",
        });
      }

      const message: ChatMessage = await addMessage(db, {
        canvasId,
        role: "assistant",
        text: reply.trim() || `(${attempt.status})`,
        attemptId: attempt.id,
        agentId: agent?.id,
        target: target?.id,
      });

      if (agent && target) {
        await release(db, target.id, agent);
      }
      await emitChanges();
      await emit({ type: "done", status: attempt.status, message });
    } catch (error) {
      if (agent && target) {
        await release(db, target.id, agent).catch(() => {});
      }
      await emit({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      await emit({ type: "done", status: "error", message: null });
    } finally {
      if (secret) {
        unregisterRun(secret);
      }
      runs.delete(runKey);
    }
  };
}
