import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "shared";
import { api } from "./http";

export const settingsKey = ["settings"] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async () => (await api.get<Settings>("/settings")).data,
    retry: false,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Settings>) =>
      (await api.patch<Settings>("/settings", patch)).data,
    onSuccess: (settings) => queryClient.setQueryData(settingsKey, settings),
  });
}
