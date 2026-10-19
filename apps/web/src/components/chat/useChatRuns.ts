import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CanvasEdge, CanvasNode, ChatMessage, RunInfo } from "shared";
import { canvasKey } from "../../api/canvases";
import { messagesKey, streamChat } from "../../api/chat";

export type LiveRun = {
  info: RunInfo;
  text: string;
  tokens: number;
  tool: string | null;
  notes: string[];
};

/** Sends chat messages and tracks every run streaming on this canvas. */
export function useChatRuns(
  canvasId: string,
  onCards: (nodes: CanvasNode[], edges: CanvasEdge[]) => void,
) {
  const queryClient = useQueryClient();
  const [runs, setRuns] = useState<Record<string, LiveRun>>({});
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, change: (run: LiveRun) => LiveRun) =>
    setRuns((current) =>
      current[key] ? { ...current, [key]: change(current[key]) } : current,
    );

  const addMessage = (message: ChatMessage) =>
    queryClient.setQueryData<ChatMessage[]>(messagesKey(canvasId), (list) => [
      ...(list ?? []),
      message,
    ]);

  const send = async (text: string, model: string | null = null) => {
    let key = "";
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
          case "warning":
          case "error":
            lastProblem = event.message;
            update(key, (run) => ({
              ...run,
              notes: [...run.notes, event.message],
            }));
            break;
          case "done":
            if (event.message) {
              addMessage(event.message);
            }
            if (event.status === "error") {
              setError(lastProblem);
            }
            setRuns(({ [key]: _finished, ...rest }) => rest);
            queryClient.invalidateQueries({ queryKey: canvasKey(canvasId) });
            break;
        }
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      if (key) {
        setRuns(({ [key]: _failed, ...rest }) => rest);
      }
    }
  };

  return { runs: Object.values(runs), error, send };
}
