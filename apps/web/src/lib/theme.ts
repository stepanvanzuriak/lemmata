import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "lemmata-theme";
const CHANGE_EVENT = "lemmata-theme";

const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") {
    return preference;
  }

  return systemQuery().matches ? "dark" : "light";
}

function apply(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    // Not handled
  }

  apply(resolve(preference));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const query = systemQuery();
  const onSystemChange = () => {
    apply(resolve(readPreference()));
    onChange();
  };

  query.addEventListener("change", onSystemChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onSystemChange);

  return () => {
    query.removeEventListener("change", onSystemChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onSystemChange);
  };
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference);
  const resolved = useSyncExternalStore(subscribe, () => resolve(preference));

  return { preference, resolved, setPreference: setThemePreference };
}
