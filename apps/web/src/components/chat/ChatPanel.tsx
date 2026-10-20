import { useEffect, useRef, useState } from "react";
import {
  Button,
  CloseButton,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import clsx from "clsx";
import { ChevronsLeft, ChevronsRight, Comments } from "@gravity-ui/icons";
import type { CanvasAgent, CanvasEdge, CanvasNode, ChatMessage } from "shared";
import {
  useAbortRun,
  useAgents,
  useMessages,
  useRemoveAgent,
} from "../../api/chat";
import { useChatStore } from "../../stores/chat";
import { Markdown } from "../common/Markdown";
import { AgentDialog } from "./AgentDialog";
import { ModelSelect } from "./ModelSelect";
import { useChatRuns, type LiveRun } from "./useChatRuns";

const ROLES = ["prover", "referee"] as const;
const STICK_DISTANCE = 48;

const roleName = (role: string) => role[0]!.toUpperCase() + role.slice(1);

function speaker(message: ChatMessage, agents: CanvasAgent[]) {
  if (message.role === "user") {
    return "You";
  }
  const agent = agents.find((a) => a.id === message.agentId);
  return agent ? roleName(agent.role) : "Assistant";
}

function MessageBubble({
  message,
  agents,
}: {
  message: ChatMessage;
  agents: CanvasAgent[];
}) {
  const mine = message.role === "user";

  return (
    <div className={clsx("flex flex-col gap-1", mine && "items-end")}>
      <span className="text-[11px] text-lm-muted">
        {speaker(message, agents)}
      </span>
      <div
        className={clsx(
          "max-w-full rounded-xl px-3 py-2 text-sm leading-normal",
          mine
            ? "bg-lm-accent-soft text-lm-ink"
            : "bg-lm-surface border border-lm-line",
        )}
      >
        {mine ? (
          <span className="whitespace-pre-wrap">{message.text}</span>
        ) : (
          <Markdown>{message.text}</Markdown>
        )}
      </div>
    </div>
  );
}

function LiveRunBubble({ run, onStop }: { run: LiveRun; onStop: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-lm-accent/40 bg-lm-tint-work px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] text-lm-muted">
        <Spinner size="sm" />
        <span className="font-semibold text-lm-accent-ink">
          {roleName(run.info.role)}
        </span>
        {run.info.model && <span className="font-mono">{run.info.model}</span>}
        <span className="font-mono">{run.tokens.toLocaleString()} tok</span>
        <Button
          size="sm"
          variant="danger-soft"
          className="ml-auto"
          onPress={onStop}
        >
          Stop
        </Button>
      </div>
      {run.tool && (
        <span className="font-mono text-[11px] text-lm-muted">
          → {run.tool}
        </span>
      )}
      {run.text && <Markdown className="text-sm">{run.text}</Markdown>}
      {run.notes.map((note, index) => (
        <span key={index} className="text-xs text-lm-danger">
          {note}
        </span>
      ))}
    </div>
  );
}

function AgentBar({
  canvasId,
  agents,
  running,
}: {
  canvasId: string;
  agents: CanvasAgent[];
  running: Set<string>;
}) {
  const removeAgent = useRemoveAgent(canvasId);
  const [dialog, setDialog] = useState<{
    role: CanvasAgent["role"];
    agent?: CanvasAgent;
  } | null>(null);
  const missing = ROLES.filter((role) => !agents.some((a) => a.role === role));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {agents.map((agent) => (
        <span
          key={agent.id}
          className="flex items-center gap-1 rounded-full border border-lm-line bg-lm-surface py-0.5 pr-0.5 pl-1 text-xs"
        >
          <button
            type="button"
            aria-label={`${roleName(agent.role)} settings`}
            className="flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-1.5 py-0.5 text-xs text-lm-ink hover:bg-lm-chip"
            onClick={() => setDialog({ role: agent.role, agent })}
          >
            <span
              aria-hidden="true"
              className={clsx(
                "size-1.5 rounded-full",
                running.has(agent.id)
                  ? "lm-pulse bg-lm-accent"
                  : "bg-lm-muted/50",
              )}
            />
            {roleName(agent.role)}
            <span className="font-mono text-lm-muted">
              {agent.model ?? "default"}
            </span>
          </button>
          <CloseButton
            aria-label={`Remove ${agent.role}`}
            className="size-5"
            onPress={() => removeAgent.mutate(agent.id)}
          />
        </span>
      ))}
      {missing.map((role) => (
        <Button
          key={role}
          size="sm"
          variant="tertiary"
          onPress={() => setDialog({ role })}
        >
          + {roleName(role)}
        </Button>
      ))}
      {dialog && (
        <AgentDialog
          key={dialog.agent?.id ?? dialog.role}
          canvasId={canvasId}
          role={dialog.role}
          agent={dialog.agent}
          isOpen
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
    </div>
  );
}

export function ChatPanel({
  canvasId,
  onCards,
}: {
  canvasId: string;
  onCards: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
}) {
  const { data: messages = [] } = useMessages(canvasId);
  const { data: agents = [] } = useAgents(canvasId);
  const abortRun = useAbortRun(canvasId);
  const { runs, error, send } = useChatRuns(canvasId, onCards);
  const setSend = useChatStore((state) => state.setSend);
  const collapsed = useChatStore((state) => state.collapsed);
  const assistantModel = useChatStore((state) => state.assistantModel);
  const setAssistantModel = useChatStore((state) => state.setAssistantModel);
  const setCollapsed = useChatStore((state) => state.setCollapsed);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const running = new Set(runs.map((run) => run.info.runKey));
  const liveText = runs.map((run) => run.text.length + run.notes.length).join();

  useEffect(() => {
    setSend((text) => {
      setCollapsed(false);
      stick.current = true;
      send(text, assistantModel);
    });
    return () => setSend(null);
  });

  useEffect(() => {
    if (stick.current && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [messages.length, runs.length, liveText]);

  const submit = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setDraft("");
    stick.current = true;
    send(text, assistantModel);
  };

  if (collapsed) {
    return (
      <aside
        aria-label="Chat"
        className="flex w-11 shrink-0 flex-col items-center gap-2 border-l border-lm-line bg-lm-aside py-3"
      >
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Open chat"
          onPress={() => setCollapsed(false)}
        >
          <ChevronsLeft width={16} height={16} aria-hidden="true" />
        </Button>
        <Comments
          width={16}
          height={16}
          aria-hidden="true"
          className="text-lm-muted"
        />
        {runs.length > 0 && (
          <span
            title={`${runs.length} running`}
            className="lm-pulse flex size-5 items-center justify-center rounded-full bg-lm-accent text-[10px] font-semibold text-white"
          >
            {runs.length}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Chat"
      className="flex w-90 shrink-0 flex-col border-l border-lm-line bg-lm-aside"
    >
      <div className="flex flex-col gap-2 border-b border-lm-line p-3">
        <div className="flex items-center">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-lm-muted uppercase">
            Agents
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Collapse chat"
            className="ml-auto"
            onPress={() => setCollapsed(true)}
          >
            <ChevronsRight width={16} height={16} aria-hidden="true" />
          </Button>
        </div>
        <AgentBar canvasId={canvasId} agents={agents} running={running} />
      </div>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
        onScroll={(event) => {
          const el = event.currentTarget;
          stick.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < STICK_DISTANCE;
        }}
      >
        {messages.length === 0 && runs.length === 0 && (
          <p className="m-0 text-xs text-lm-muted">
            Ask the Assistant anything, or add a Prover and send{" "}
            <code>/prover goal</code>.
          </p>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} agents={agents} />
        ))}
        {runs.map((run) => (
          <LiveRunBubble
            key={run.info.runKey}
            run={run}
            onStop={() => abortRun.mutate(run.info.runKey)}
          />
        ))}
      </div>

      <form
        className="flex flex-col gap-1.5 border-t border-lm-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {error && (
          <p role="alert" className="m-0 text-xs text-lm-danger">
            {error}
          </p>
        )}
        <TextField aria-label="Message" value={draft} onChange={setDraft}>
          <TextArea
            rows={3}
            placeholder="Message, /prover H1, /prover open or /referee settled"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </TextField>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-lm-muted">
            Enter sends · Shift+Enter: new line
          </span>
          <ModelSelect
            className="ml-auto w-32"
            value={assistantModel}
            onChange={setAssistantModel}
          />
        </div>
      </form>
    </aside>
  );
}
