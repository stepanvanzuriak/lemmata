import { useMatches } from "react-router";
import { useProjectStore } from "../stores/project";
import { resolveTheme, useThemeStore } from "../stores/theme";
import type { RouteHandle } from "./router";

export function useRouteTitle() {
  return (
    useMatches()
      .map((match) => (match.handle as RouteHandle | undefined)?.title)
      .findLast(Boolean) ?? ""
  );
}

export function useCurrentProjectId(projectIds: string[]) {
  const stored = useProjectStore((state) => state.currentProjectId);

  return stored && projectIds.includes(stored) ? stored : projectIds[0];
}

export function useTheme() {
  const preference = useThemeStore((state) => state.preference);
  const resolved = useThemeStore(resolveTheme);
  const setPreference = useThemeStore((state) => state.setPreference);

  return { preference, resolved, setPreference };
}
