import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useTheme } from "../../lib/hooks";
import { useThemeStore } from "../../stores/theme";

const theme = () => document.documentElement.dataset.theme;

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({ preference: "system", systemDark: false });
});

it("follows the system while the preference is system", () => {
  expect(theme()).toBe("light");

  act(() => useThemeStore.setState({ systemDark: true }));

  expect(theme()).toBe("dark");
});

it("applies and persists an explicit choice", () => {
  act(() => useThemeStore.getState().setPreference("dark"));

  expect(theme()).toBe("dark");
  expect(JSON.parse(localStorage.getItem("lemmata-theme") ?? "{}")).toEqual({
    state: { preference: "dark" },
    version: 0,
  });
});

it("ignores the system once a choice is made", () => {
  act(() => useThemeStore.getState().setPreference("light"));
  act(() => useThemeStore.setState({ systemDark: true }));

  expect(theme()).toBe("light");
});

it("exposes preference and resolved theme through useTheme", () => {
  const { result } = renderHook(() => useTheme());

  act(() => result.current.setPreference("dark"));

  expect(result.current.preference).toBe("dark");
  expect(result.current.resolved).toBe("dark");
});

it("survives the old plain-string storage format", async () => {
  localStorage.setItem("lemmata-theme", "dark");

  await expect(useThemeStore.persist.rehydrate()).resolves.not.toThrow();
  expect(useThemeStore.getState().preference).toBe("system");
});
