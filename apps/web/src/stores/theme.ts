import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type ThemeState = {
  preference: ThemePreference;
  systemDark: boolean;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = "lemmata-theme";

const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      systemDark: systemQuery.matches,
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: STORAGE_KEY,
      partialize: ({ preference }) => ({ preference }),
    },
  ),
);

export function resolveTheme({
  preference,
  systemDark,
}: Pick<ThemeState, "preference" | "systemDark">): ResolvedTheme {
  if (preference !== "system") {
    return preference;
  }

  return systemDark ? "dark" : "light";
}

const apply = (state: ThemeState) => {
  document.documentElement.dataset.theme = resolveTheme(state);
};

apply(useThemeStore.getState());
useThemeStore.subscribe(apply);

systemQuery.addEventListener("change", (event) => {
  useThemeStore.setState({ systemDark: event.matches });
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    useThemeStore.persist.rehydrate();
  }
});
