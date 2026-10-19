import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import type { SearchResult } from "shared";
import { api } from "./http";

const DEBOUNCE_MS = 200;

export async function search(q: string) {
  const { data } = await api.get<SearchResult[]>("/search", {
    params: { q },
  });

  return data;
}

export function useSearch(q: string) {
  const [debounced] = useDebouncedValue(q, { wait: DEBOUNCE_MS });

  const term = debounced.trim();

  return useQuery({
    queryKey: ["search", term],
    queryFn: () => search(term),
    enabled: term !== "",
  });
}
