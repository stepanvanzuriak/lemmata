import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddAgentRequest,
  CanvasAgent,
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ModelOption,
  RunInfo,
} from "shared";
import { api, ApiError, authHeaders } from "./http";

export class SseParser {
  private buffer = "";

  push(chunk: string): ChatEvent[] {
    this.buffer = (this.buffer + chunk).replaceAll("\r\n", "\n");
    const frames = this.buffer.split("\n\n");
    this.buffer = frames.pop() ?? "";

    return frames.flatMap((frame) => {
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");

      return data ? [JSON.parse(data) as ChatEvent] : [];
    });
  }
}

export async function streamChat(
  canvasId: string,
  request: ChatRequest,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(`/api/canvases/${canvasId}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(
      res.status,
      body.error ?? `Request failed: ${res.status}`,
    );
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parser = new SseParser();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    parser.push(value).forEach(onEvent);
  }
}

export const messagesKey = (canvasId: string) =>
  ["canvas", canvasId, "messages"] as const;
export const agentsKey = (canvasId: string) =>
  ["canvas", canvasId, "agents"] as const;

export const MESSAGE_PAGE = 50;

export const fetchMessages = async (canvasId: string, before?: string) =>
  (
    await api.get<ChatMessage[]>(`/canvases/${canvasId}/messages`, {
      params: { limit: MESSAGE_PAGE, before },
    })
  ).data;

/** The newest page of the chat; older pages come from `fetchMessages`. */
export function useMessages(canvasId: string) {
  return useQuery({
    queryKey: messagesKey(canvasId),
    queryFn: () => fetchMessages(canvasId),
  });
}

export function useAgents(canvasId: string) {
  return useQuery({
    queryKey: agentsKey(canvasId),
    queryFn: async () =>
      (await api.get<CanvasAgent[]>(`/canvases/${canvasId}/agents`)).data,
  });
}

export const runsKey = (canvasId: string) =>
  ["canvas", canvasId, "runs"] as const;

export function useServerRuns(canvasId: string) {
  return useQuery({
    queryKey: runsKey(canvasId),
    queryFn: async () =>
      (await api.get<RunInfo[]>(`/canvases/${canvasId}/runs`)).data,
    refetchInterval: (query) => (query.state.data?.length ? 3_000 : false),
  });
}

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: async () => (await api.get<ModelOption[]>("/models")).data,
    staleTime: Infinity,
  });
}

export function useUpdateAgent(canvasId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Omit<AddAgentRequest, "role">) =>
      (
        await api.patch<CanvasAgent>(
          `/canvases/${canvasId}/agents/${id}`,
          patch,
        )
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: agentsKey(canvasId) }),
  });
}

export function useAddAgent(canvasId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddAgentRequest) =>
      (await api.post<CanvasAgent>(`/canvases/${canvasId}/agents`, input)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: agentsKey(canvasId) }),
  });
}

export function useRemoveAgent(canvasId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agentId: string) =>
      (await api.delete<CanvasAgent>(`/canvases/${canvasId}/agents/${agentId}`))
        .data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: agentsKey(canvasId) }),
  });
}

export function useAbortRun(canvasId: string) {
  return useMutation({
    mutationFn: async (runKey: string) =>
      (
        await api.post<{ aborted: number }>(
          `/canvases/${canvasId}/chat/abort`,
          null,
          { params: { agent: runKey } },
        )
      ).data,
  });
}
