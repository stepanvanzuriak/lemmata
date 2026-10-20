import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CanvasEdge, CanvasNode, ChatMessage, RunInfo } from "shared";
import { canvasKey } from "../../api/canvases";
import { memoryKey } from "../../api/memory";
import {
  messagesKey,
  runsKey,
  streamChat,
  useServerRuns,
} from "../../api/chat";

export type LiveRun = {
  info: RunInfo;
  text: string;
  tokens: number;
  tool: string | null;
  notes: string[];
};

const DROPPED =
  "Lost the connection to the daemon (did it restart?). If the run survived, its reply appears here when it finishes.";

export function useChatRuns(
  canvasId: string,
  onCards: (nodes: CanvasNode[], edges: CanvasEdge[]) => void,
) {
  const queryClient = useQueryClient();
  const [runs, setRuns] = useState<Record<string, LiveRun>>({});
  const [error, setError] = useState<string | null>(null);
  const server = useServerRuns(canvasId);
  const orphans = (server.data ?? []).filter((run) => !runs[run.runKey]);
  const orphanKeys = orphans.map((run) => run.runKey).join();
  const lastOrphans = useRef(orphanKeys);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: messagesKey(canvasId) });
    queryClient.invalidateQueries({ queryKey: canvasKey(canvasId) });
  };

  const update = (key: string, change: (run: LiveRun) => LiveRun) =>
    setRuns((current) =>
      current[key] ? { ...current, [key]: change(current[key]) } : current,
    );

  const finish = (key: string) => {
    setRuns(({ [key]: _finished, ...rest }) => rest);
    queryClient.setQueryData<RunInfo[]>(runsKey(canvasId), (list) =>
      list?.filter((run) => run.runKey !== key),
    );
  };

  const addMessage = (message: ChatMessage) =>
    queryClient.setQueryData<ChatMessage[]>(messagesKey(canvasId), (list) => [
      ...(list ?? []),
      message,
    ]);

  const send = async (text: string, model: string | null = null) => {
    let key = "";
    let done = false;
    let lastProblem = "The run failed.";
    setError(null);

    try {
      await streamChat(canvasId, { text, model }, (event) => {
        switch (event.type) {
          case "user":
            key = event.run.runKey;
            addMessage(event.message);
            setRuns((current) => ({
              ...current,
              [key]: {
                info: event.run,
                text: "",
                tokens: 0,
                tool: null,
                notes: [],
              },
            }));
            break;
          case "text":
            update(key, (run) => ({ ...run, text: run.text + event.text }));
            break;
          case "tool_use":
            update(key, (run) => ({ ...run, tool: event.name }));
            break;
          case "usage":
            update(key, (run) => ({ ...run, tokens: event.tokens }));
            break;
          case "cards":
            onCards(event.nodes, event.edges);
            break;
          case "memory":
            queryClient.invalidateQueries({ queryKey: memoryKey });
            update(key, (run) => ({
              ...run,
              notes: [
                ...run.notes,
                `Saved ${event.saved} ${event.saved === 1 ? "note" : "notes"} to research memory.`,
              ],
            }));
            break;
          case "warning":
          case "error":
            lastProblem = event.message;
            update(key, (run) => ({
              ...run,
              notes: [...run.notes, event.message],
            }));
            break;
          case "done":
            done = true;
            if (event.message) {
              addMessage(event.message);
            }
            if (event.status === "error") {
              setError(lastProblem);
            }
            finish(key);
            queryClient.invalidateQueries({ queryKey: canvasKey(canvasId) });
            break;
        }
      });

      if (key && !done) {
        setError(DROPPED);
        finish(key);
        refresh();
        queryClient.invalidateQueries({ queryKey: runsKey(canvasId) });
      }
    } catch (failure) {
      if (!key) {
        setError(failure instanceof Error ? failure.message : String(failure));
        return;
      }
      setError(DROPPED);
      finish(key);
      refresh();
      queryClient.invalidateQueries({ queryKey: runsKey(canvasId) });
    }
  };

  useEffect(() => {
    const before = lastOrphans.current.split(",").filter(Boolean);
    lastOrphans.current = orphanKeys;

    if (before.some((key) => !orphanKeys.split(",").includes(key))) {
      queryClient.invalidateQueries({ queryKey: messagesKey(canvasId) });
      queryClient.invalidateQueries({ queryKey: canvasKey(canvasId) });
    }
  }, [orphanKeys, canvasId, queryClient]);

  return { runs: Object.values(runs), orphans, error, send };
}
