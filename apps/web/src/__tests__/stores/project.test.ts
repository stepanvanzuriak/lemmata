import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useCurrentProjectId } from "../../lib/hooks";
import { useProjectStore } from "../../stores/project";

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ currentProjectId: null });
});

it("falls back to the first project when nothing was picked", () => {
  const { result } = renderHook(() => useCurrentProjectId(["a", "b"]));

  expect(result.current).toBe("a");
});

it("follows the picked project and persists it", () => {
  const { result } = renderHook(() => useCurrentProjectId(["a", "b"]));

  act(() => useProjectStore.getState().setCurrentProjectId("b"));

  expect(result.current).toBe("b");
  expect(
    JSON.parse(localStorage.getItem("lemmata-current-project") ?? "{}"),
  ).toMatchObject({ state: { currentProjectId: "b" } });
});

it("ignores a picked project that no longer exists", () => {
  useProjectStore.setState({ currentProjectId: "deleted" });
  const { result } = renderHook(() => useCurrentProjectId(["a"]));

  expect(result.current).toBe("a");
});

it("is undefined without projects", () => {
  const { result } = renderHook(() => useCurrentProjectId([]));

  expect(result.current).toBeUndefined();
});
