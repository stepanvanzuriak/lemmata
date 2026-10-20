import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddMemoryRequest,
  MemoryEntry,
  MemoryKind,
  UpdateMemoryRequest,
} from "shared";
import { api } from "./http";

export type MemoryFilter = { projectId?: string; kind?: MemoryKind };

export const memoryKey = ["memory"] as const;

export async function getMemory(filter: MemoryFilter) {
  const { data } = await api.get<MemoryEntry[]>("/memory", { params: filter });

  return data;
}

export function useMemory(filter: MemoryFilter = {}) {
  return useQuery({
    queryKey: [...memoryKey, filter],
    queryFn: () => getMemory(filter),
  });
}

function useMemoryMutation<Input>(
  mutationFn: (input: Input) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memoryKey }),
  });
}

export function useAddMemory() {
  return useMemoryMutation(
    ({ projectId, ...input }: AddMemoryRequest & { projectId: string }) =>
      api.post<MemoryEntry>(`/projects/${projectId}/memory`, input),
  );
}

export function useUpdateMemory() {
  return useMemoryMutation(
    ({ id, ...patch }: UpdateMemoryRequest & { id: string }) =>
      api.patch<MemoryEntry>(`/memory/${id}`, patch),
  );
}

export function useDeleteMemory() {
  return useMemoryMutation((id: string) => api.delete(`/memory/${id}`));
}
