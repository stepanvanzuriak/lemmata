import { beforeEach, expect, it } from "vitest";
import { setThemePreference } from "../../lib/theme";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

it("stores an explicit choice and applies it", () => {
  setThemePreference("dark");

  expect(localStorage.getItem("lemmata-theme")).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
});

it("forgets the choice for system and applies the resolved theme", () => {
  setThemePreference("dark");
  setThemePreference("system");

  expect(localStorage.getItem("lemmata-theme")).toBeNull();
  expect(document.documentElement.dataset.theme).toMatch(/^(light|dark)$/);
});
