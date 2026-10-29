import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { DebugAttempt, DebugEventPage } from "shared";
import { api } from "./http";

const base = (canvasId: string) => `/debug/canvases/${canvasId}/attempts`;

export function useDebugAttempts(canvasId: string) {
  return useQuery({
    queryKey: ["debugAttempts", canvasId],
    queryFn: async () => (await api.get<DebugAttempt[]>(base(canvasId))).data,
    refetchInterval: 2000,
  });
}

export function useDebugEvents(canvasId: string, attemptId?: string) {
  return useInfiniteQuery({
    queryKey: ["debugEvents", canvasId, attemptId],
    enabled: Boolean(attemptId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<DebugEventPage>(`${base(canvasId)}/${attemptId}/events`, {
          params: { after: pageParam },
        })
      ).data,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 2000,
  });
}
