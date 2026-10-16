import { useQuery } from "@tanstack/react-query";
import type { WorkspaceInfo } from "shared";
import { api } from "./http";

export async function getWorkspace() {
  const { data } = await api.get<WorkspaceInfo>("/workspace");

  return data;
}

export const workspaceKey = ["workspace"] as const;

export function useWorkspace() {
  return useQuery({
    queryKey: workspaceKey,
    queryFn: getWorkspace,
    refetchInterval: 10_000,
    retry: false,
  });
}
