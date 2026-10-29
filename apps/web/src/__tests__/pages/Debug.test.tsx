import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, it, vi } from "vitest";
import { DebugPage } from "../../pages/Debug";

const get = vi.hoisted(() => vi.fn());
vi.mock("../../api/http", () => ({ api: { get } }));

it("selects runs per canvas and loads full event payloads through cursor pages", async () => {
  const long = "Full command output ".repeat(1000);
  get.mockImplementation(
    async (url: string, options?: { params?: { after: number } }) => {
      if (url.endsWith("/attempts")) {
        return {
          data: [
            {
              id: "a1",
              title: "/prover H32",
              status: "done",
              model: "test",
              startedAt: "now",
            },
            {
              id: "a2",
              title: "/referee H32",
              status: "error",
              model: "test",
              startedAt: "then",
            },
          ],
        };
      }
      if (url.includes("/a2/")) {
        return { data: { events: [], nextCursor: null } };
      }
      const after = options?.params?.after ?? 0;
      return {
        data: {
          events: [
            {
              id: after ? 2 : 1,
              kind: after ? "agent.tool_result" : "run.start",
              createdAt: "now",
              data: after ? { output: long } : { request: "/prover H32" },
            },
          ],
          nextCursor: after ? null : 1,
        },
      };
    },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/canvas/c1/debug"]}>
        <Routes>
          <Route path="/canvas/:id/debug" element={<DebugPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("run.start")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Load more events" }));
  expect(await screen.findByText("agent.tool_result")).toBeTruthy();
  expect(
    screen.getAllByText(
      (_, element) =>
        element?.tagName === "PRE" &&
        Boolean(element.textContent?.includes(long)),
    ),
  ).toHaveLength(1);
  expect(get).toHaveBeenCalledWith("/debug/canvases/c1/attempts/a1/events", {
    params: { after: 1 },
  });
  fireEvent.click(screen.getByRole("button", { name: /\/referee H32/ }));
  expect(await screen.findByText("No recorded events")).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByText("agent.tool_result")).toBeNull(),
  );
});
