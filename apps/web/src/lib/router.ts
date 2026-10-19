import { createBrowserRouter } from "react-router";
import { AppShell } from "../components/common/AppShell";
import { RouteError } from "../components/common/RouteError";
import { RoutePlaceholder } from "../components/common/RoutePlaceholder";
import { Settings } from "../pages/Settings";
import { Workspaces } from "../pages/Workspaces";
import { CanvasPage, CanvasRedirect } from "../pages/Canvas";

export type RouteHandle = { title: string; fullBleed?: boolean };

const placeholder = (path: string, title: string) => ({
  path,
  Component: RoutePlaceholder,
  handle: { title } satisfies RouteHandle,
});

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          {
            index: true,
            Component: Workspaces,
            handle: { title: "Workspace" } satisfies RouteHandle,
          },
          {
            path: "canvas",
            Component: CanvasRedirect,
            handle: { title: "Research canvas" } satisfies RouteHandle,
          },
          {
            path: "canvas/:id",
            Component: CanvasPage,
            handle: {
              title: "Research canvas",
              fullBleed: true,
            } satisfies RouteHandle,
          },
          placeholder("sessions", "Sessions"),
          placeholder("notebook", "Notebook"),
          placeholder("literature", "Literature"),
          placeholder("usage", "Usage & budgets"),
          {
            path: "settings",
            Component: Settings,
            handle: { title: "Settings" } satisfies RouteHandle,
          },
          placeholder("*", "Not found"),
        ],
      },
    ],
  },
]);
