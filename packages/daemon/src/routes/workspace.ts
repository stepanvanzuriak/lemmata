import { Hono } from "hono";
import type { Toolchain, WorkspaceInfo } from "shared";

export type WorkspaceRouteOptions = {
  dir: string;
  address: () => string;
  toolchain: Promise<Toolchain>;
};

export function workspaceRoutes({
  dir,
  address,
  toolchain,
}: WorkspaceRouteOptions) {
  return new Hono().get("/", async (c) =>
    c.json({
      dir,
      address: address(),
      toolchain: await toolchain,
    } satisfies WorkspaceInfo),
  );
}
