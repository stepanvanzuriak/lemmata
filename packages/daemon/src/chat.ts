import {
  addMessage,
  archiveMessages,
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
  attackParent,
  expandCommand,
  findTarget,
  parseCommand,
  release,
} from "./agents.js";
import { describeCanvas } from "./cards/describe.js";
import { findCard } from "./cards/find.js";
import { loadDetail } from "./cards/load.js";
import { archiveNodes } from "./cards/archive.js";
import { literatureCardFor } from "./cards/literature.js";
import { isArchived, type Author, type RunContext } from "./cards/types.js";
import { memoryPreamble } from "./memory.js";
import { mcpConfigFor, registerRun, unregisterRun } from "./mcp/registry.js";
import { CANVAS_INSTRUCTIONS } from "./mcp/instructions.js";
import type { ToolDeps } from "./mcp/tools/index.js";
import { ROLE_PROMPTS } from "./roles.js";
import { projectDir } from "./runCard.js";
import { parseTask, taskPrompt } from "./tasks.js";
import { resolveModel } from "./providers.js";
import { readSettings } from "./routes/settings.js";

export const DEFAULT_MAX_TOKENS = 1_000_000;

/** Model turns per run; every turn re-reads the whole context, so long tool loops cost the most. */
export const MAX_TURNS = 30;

/** The referee reads and writes a few notes; longer loops only re-read context. */
const ROLE_MAX_TURNS: Partial<Record<string, number>> = { referee: 12 };

/** Claude's prompt cache lives an hour; resuming an older session re-writes its whole history. */
const CLAUDE_RESUME_WINDOW_MS = 55 * 60_000;

/** These roles start fresh each run: the canvas holds their state, and a resumed session only piles up old canvas dumps. */
const FRESH_ROLES = new Set<string>(["prover", "referee"]);

export type ChatDeps = ToolDeps & {
  port: () => number;
  adapter?: () => AgentAdapter;
};

export type Emit = (event: ChatEvent) => Promise<void>;

type ActiveRun = { controller: AbortController; info: RunInfo };

const active = new Map<string, Map<string, ActiveRun>>();

export function activeRuns(canvasId: string): RunInfo[] {
  return [...(active.get(canvasId)?.values() ?? [])].map(({ info }) => info);
}

export function abortRuns(canvasId: string, runKey?: string): number {
  const runs = active.get(canvasId);
  const keys = runKey ? [runKey] : [...(runs?.keys() ?? [])];
  let count = 0;

  for (const key of keys) {
    const run = runs?.get(key);
    if (run) {
      run.controller.abort();
      count += 1;
    }
  }
  return count;
}

/** Sent once, in the same session, when a prover run ends without touching the canvas. */
export const STUCK_NUDGE =
  "You changed nothing on the canvas. Do not stop here: follow the rule for when you cannot settle the target, and leave at least one new card (a sub-lemma, a special case, or a check) that a later run can pick up. Then reply in two sentences.";

const staleNotice = (canvas: string) =>
  `This session continues an earlier run, and the canvas has changed since. What you remember of it may be out of date: cards were added and hypotheses settled. This is the canvas now; trust it over your memory.\n\n${canvas}`;

export class CanvasNotFound extends Error {}

const contentOf = (node: CanvasDetail["nodes"][number]) =>
  `${node.kind}:${JSON.stringify(node.payload)}`;

function snapshot(detail: CanvasDetail) {
  return {
    nodes: new Map(detail.nodes.map((n) => [n.id, contentOf(n)])),
    edges: new Set(detail.edges.map((e) => e.id)),
  };
}

function changes(before: ReturnType<typeof snapshot>, after: CanvasDetail) {
  return {
    nodes: after.nodes.filter((n) => before.nodes.get(n.id) !== contentOf(n)),
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
  const task = command ? null : parseTask(request.text);
  let agent: CanvasAgent | undefined;
  let target: CanvasDetail["nodes"][number] | undefined;

  if (command) {
    agent = (await listAgents(db, canvasId)).find(
      (a) => a.role === command.role,
    );
    target = findTarget(detail, command);

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

  if (task) {
    target = findCard(detail, task.ref);

    if (target?.kind === "literature") {
      const about = (target.payload as { target?: string }).target;
      target = detail.nodes.find((n) => n.id === about) ?? target;
    }

    if (!target) {
      throw new ConflictError(
        "no_target",
        `No card matches "${task.ref}". Use goal, a label such as H2, or a card id.`,
      );
    }
  }

  const selectedModel = agent ? agent.model : (request.model ?? null);
  const selection = deps.adapter
    ? null
    : resolveModel(await readSettings(deps.workspaceDir), selectedModel);
  const adapter = deps.adapter?.() ?? createAdapter(selection!.provider);
  const modelId = selection ? selection.id : selectedModel;

  const runKey = agent?.id ?? task?.role ?? "assistant";
  const runs = active.get(canvasId) ?? new Map<string, ActiveRun>();

  if (runs.has(runKey)) {
    throw new ConflictError(
      "busy",
      "This agent is already running. Stop it or wait.",
    );
  }

  const role = agent?.role ?? task?.role ?? "assistant";
  const author: Author = agent
    ? { role: agent.role, agentId: agent.id }
    : { role };
  const run: RunInfo = {
    runKey,
    role,
    model: selectedModel,
    target: target?.id ?? null,
  };
  const controller = new AbortController();
  runs.set(runKey, { controller, info: run });
  active.set(canvasId, runs);
  const project = canvas.project;

  return async (emit) => {
    let secret: string | null = null;
    let seen = snapshot(detail);
    let reply = "";
    let tokens = 0;
    const touched = new Set<string>();

    const emitChanges = async () => {
      const current = await loadDetail(db, canvasId);
      const changed = changes(seen, current);
      seen = snapshot(current);

      for (const node of changed.nodes) {
        touched.add(node.id);
      }

      if (changed.nodes.length > 0 || changed.edges.length > 0) {
        await emit({ type: "cards", ...changed });
      }
    };

    /** Archives what was on the canvas before the run, once the run has written its key points. */
    const finishReset = async (
      attempt: { id: string; status: string },
      command: ChatMessage,
    ) => {
      const before = new Set(detail.nodes.map((n) => n.id));
      const current = await loadDetail(db, canvasId);
      const added = current.nodes.filter((n) => !before.has(n.id));
      const replaced = current.nodes.filter(
        (n) =>
          before.has(n.id) &&
          n.kind !== "goal" &&
          n.kind !== "toolbox" &&
          !isArchived(n),
      );

      if (attempt.status !== "done" || added.length === 0) {
        await emit({
          type: "warning",
          message: "The reset wrote no key points, so nothing was archived.",
        });
        return;
      }

      await archiveNodes(
        db,
        replaced.map((n) => n.id),
        { by: attempt.id, reason: "reset to key points" },
      );
      // The conversation before the reset is about cards that are gone; the /reset exchange stays.
      await archiveMessages(db, canvasId, command.id, attempt.id);
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

      const literature =
        task?.role === "literature" && target
          ? await literatureCardFor(db, detail, target)
          : undefined;

      if (literature) {
        await emitChanges();
      }

      const parent =
        target?.kind === "attack" ? attackParent(detail, target) : undefined;
      const focus = [target?.id, parent?.id, literature?.card.id].filter(
        (id): id is string => Boolean(id),
      );
      const runContext: RunContext = {
        canvasId,
        author,
        target: target?.id,
        focus,
      };

      const resumeSessionId =
        task || FRESH_ROLES.has(role)
          ? undefined
          : ((await lastSessionId(
              db,
              canvasId,
              agent?.id ?? null,
              target?.id ?? null,
              adapter.name,
              adapter.name === "claude" ? CLAUDE_RESUME_WINDOW_MS : undefined,
            )) ?? undefined);
      const promptFor = () => {
        if (command && target) {
          return expandCommand(command, target, detail);
        }
        if (task && target) {
          return taskPrompt(task, target, literature?.card);
        }
        return request.text;
      };
      const prompt = promptFor();
      const firstPrompt = resumeSessionId
        ? `${staleNotice(describeCanvas(detail, author, focus))}\n\n${prompt}`
        : prompt;
      let memoryReported = 0;
      secret = registerRun(runContext);

      const cwd = await projectDir(db, canvasId, deps.workspaceDir);
      const systemPromptAddendum = [
        `Project: ${project.title}\n${project.statement}`,
        await memoryPreamble(db, project.id),
        ROLE_PROMPTS[role],
        // A resumed run already gets the current canvas in its first prompt.
        resumeSessionId
          ? null
          : `Canvas at the start of this run:\n${describeCanvas(await loadDetail(db, canvasId), author, focus)}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const mcpServers = mcpConfigFor(secret, deps.port());
      const attemptOnce = (nudge?: { prompt: string; sessionId: string }) =>
        runAttempt(
          {
            db,
            adapter,
            projectId: project.id,
            canvasId,
            title: request.text.slice(0, 80),
            maxTokens: agent?.tokenCap ?? DEFAULT_MAX_TOKENS,
            signal: controller.signal,
            transcript: deps.devMode
              ? {
                  request: request.text,
                  userMessageId: userMessage.id,
                  role,
                  agentId: agent?.id,
                  target: target?.id,
                  runKey,
                  mcpInstructions: CANVAS_INSTRUCTIONS,
                }
              : undefined,
            onStart: (started) => {
              runContext.attemptId = started.id;
            },
            options: {
              cwd,
              prompt: nudge?.prompt ?? firstPrompt,
              resumeSessionId: nudge?.sessionId ?? resumeSessionId,
              model: modelId
                ? { provider: adapter.name, id: modelId }
                : undefined,
              systemPromptAddendum,
              maxTurns: ROLE_MAX_TURNS[role] ?? MAX_TURNS,
              mcpServers,
            },
          },
          async (event) => {
            if (event.type === "text") {
              reply += event.text;
              await emit({ type: "text", text: event.text });
            }
            if (event.type === "tool_use") {
              await emit({
                type: "tool_use",
                name: event.name,
                input:
                  event.name === "command_execution" &&
                  typeof event.input === "string"
                    ? event.input
                    : undefined,
              });
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

      touched.clear();
      let attempt = await attemptOnce();

      // A prover that gave up without leaving anything gets one more turn to make the target smaller.
      if (
        role === "prover" &&
        attempt.status === "done" &&
        touched.size === 0 &&
        attempt.sessionId
      ) {
        reply += "\n\n";
        await emit({ type: "text", text: "\n\n" });
        attempt = await attemptOnce({
          prompt: STUCK_NUDGE,
          sessionId: attempt.sessionId,
        });
      }

      if (task?.role === "reset") {
        await finishReset(attempt, userMessage);
      }

      if (attempt.status === "stopped_budget") {
        await emit({
          type: "warning",
          message: "Stopped: the run passed its token or turn cap.",
        });
      }

      await emitChanges();

      const message: ChatMessage = await addMessage(db, {
        canvasId,
        role: "assistant",
        text: reply.trim() || `(${attempt.status})`,
        attemptId: attempt.id,
        agentId: agent?.id,
        target: target?.id,
        cards: [...touched],
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
