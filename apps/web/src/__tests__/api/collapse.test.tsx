import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { CanvasDetail } from "shared";
import { canvasKey, useSetNodeCollapsed } from "../../api/canvases";

const patch = vi.hoisted(() => vi.fn());
vi.mock("../../api/http", () => ({ api: { patch } }));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(canvasKey("c"), {
    nodes: [
      { id: "parent", collapsed: false },
      { id: "child", collapsed: true },
    ],
    edges: [],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useSetNodeCollapsed("c"), { wrapper });
  const nodes = () => client.getQueryData<CanvasDetail>(canvasKey("c"))!.nodes;
  return { ...hook, client, nodes };
}

it("updates immediately, saves to the server, and preserves nested collapse state", async () => {
  let finish!: (value: unknown) => void;
  patch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, client, nodes } = setup();
  act(() => result.current.mutate({ id: "parent", collapsed: true }));
  await waitFor(() => expect(nodes()[0]!.collapsed).toBe(true));
  expect(nodes()[1]!.collapsed).toBe(true);
  expect(patch).toHaveBeenCalledWith("/nodes/parent/collapsed", {
    collapsed: true,
  });
  await act(async () => finish({ data: { id: "parent", collapsed: true } }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(nodes()[0]!.collapsed).toBe(true);
  client.clear();
});

it("restores the previous state if saving fails", async () => {
  patch.mockRejectedValueOnce(new Error("Save failed"));
  const { result, client, nodes } = setup();
  await act(async () => {
    await expect(
      result.current.mutateAsync({ id: "parent", collapsed: true }),
    ).rejects.toThrow("Save failed");
  });
  expect(nodes()[0]!.collapsed).toBe(false);
  expect(nodes()[1]!.collapsed).toBe(true);
  client.clear();
});
