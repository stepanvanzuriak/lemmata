import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { CanvasDetail, CanvasNode } from "shared";
import { useCanvasData } from "../../../components/canvas/useCanvasData";

const saved = vi.hoisted(() => ({
  data: {
    canvas: { id: "c" },
    nodes: [],
    edges: [],
  } as unknown as CanvasDetail,
  dataUpdatedAt: 1,
}));
vi.mock("../../../api/canvases", () => ({ useCanvas: () => saved }));

it("makes streamed cards available to the viewer before the saved canvas refreshes", () => {
  const { result, rerender } = renderHook(() => useCanvasData("c"));
  const node = {
    id: "live",
    canvasId: "c",
    kind: "note",
    x: 0,
    y: 0,
    payload: { title: "New agent card", tags: ["Graph theory"] },
    updatedAt: "1",
  } as CanvasNode;

  act(() => result.current.mergeLive([node], []));
  expect(saved.data.nodes).toHaveLength(0);
  expect(result.current.detail?.nodes.find(({ id }) => id === node.id)).toEqual(
    node,
  );

  const updated = {
    ...node,
    payload: { ...node.payload, title: "Updated live card" },
    updatedAt: "2",
  };
  act(() => result.current.mergeLive([updated], []));
  expect(result.current.detail?.nodes[0]?.payload.title).toBe(
    "Updated live card",
  );

  saved.data = { ...saved.data, nodes: [updated] };
  saved.dataUpdatedAt = 2;
  rerender();
  expect(result.current.detail?.nodes).toEqual([updated]);

  const measured = { ...updated, x: 400, y: 200, w: 340, h: 260 };
  saved.data = { ...saved.data, nodes: [measured] };
  saved.dataUpdatedAt = 3;
  rerender();
  expect(result.current.detail?.nodes[0]).toEqual(measured);
  expect(result.current.nodes[0]!.position).toEqual({ x: 400, y: 200 });

  saved.data = { ...saved.data, nodes: [{ ...measured, collapsed: true }] };
  saved.dataUpdatedAt = 4;
  rerender();
  expect(result.current.nodes[0]!.data.node.collapsed).toBe(true);
  saved.data = { ...saved.data, nodes: [{ ...measured, collapsed: false }] };
  saved.dataUpdatedAt = 5;
  rerender();
  expect(result.current.nodes[0]!.data.node.collapsed).toBe(false);
});
