import { createBrowserRouter } from "react-router";
import { AppShell } from "../components/AppShell";
import { RoutePlaceholder } from "../components/RoutePlaceholder";
import { Workspaces } from "../pages/Workspaces";

export type RouteHandle = { title: string };

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      {
        index: true,
        Component: Workspaces,
        handle: { title: "Workspace" } satisfies RouteHandle,
      },
      {
        path: "canvas",
        handle: { title: "Research canvas" } satisfies RouteHandle,
      },
      { path: "sessions", handle: { title: "Sessions" } satisfies RouteHandle },
      { path: "notebook", handle: { title: "Notebook" } satisfies RouteHandle },
      {
        path: "literature",
        handle: { title: "Literature" } satisfies RouteHandle,
      },
      {
        path: "usage",
        handle: { title: "Usage & budgets" } satisfies RouteHandle,
      },
    ],
  },
]);
