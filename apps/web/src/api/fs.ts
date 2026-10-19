import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { FsEntry, FsListResponse, MkdirInput } from "shared";
import { api } from "./http";

export async function listFolders(path: string) {
  const { data } = await api.get<FsListResponse>("/fs", {
    params: { path },
  });

  return data;
}

export async function mkdir(input: MkdirInput) {
  const { data } = await api.post<FsEntry>("/fs/mkdir", input);

  return data;
}

export const fsKey = ["fs"] as const;

export function useFsList(path?: string) {
  if (path === undefined) {
    throw new Error("Path should be defined");
  }

  return useQuery({
    queryKey: [...fsKey, path],
    queryFn: () => listFolders(path),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useMkdir() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mkdir,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fsKey }),
  });
}
