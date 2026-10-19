import {
  getCanvas,
  parsePayload,
  type CanvasNode as CanvasNodeRow,
  type Db,
} from "core";
import type { CanvasDetail, CanvasNode, NodeKind } from "shared";
import { ToolRefusal } from "./types.js";

export async function loadDetail(
  db: Db,
  canvasId: string,
): Promise<CanvasDetail> {
  const detail = await getCanvas(db, canvasId);

  if (!detail) {
    throw new ToolRefusal(`Canvas ${canvasId} no longer exists.`);
  }

  return {
    ...detail,
    nodes: detail.nodes.map(toCanvasNode),
  };
}

export function toCanvasNode(row: CanvasNodeRow): CanvasNode {
  return {
    ...row,
    kind: row.kind as NodeKind,
    payload: parsePayload(row.payload) as CanvasNode["payload"],
  };
}
