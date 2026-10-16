import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { beforeEach, expect, it } from "vitest";
import { api, ApiError, captureToken } from "../../api/http";

let sent: InternalAxiosRequestConfig | undefined;

function respond(status: number, data: unknown) {
  const adapter: AxiosAdapter = async (config) => {
    sent = config;
    const response = { data, status, statusText: "", headers: {}, config };

    if (status >= 400) {
      throw Object.assign(new Error(`status ${status}`), {
        isAxiosError: true,
        config,
        response,
      });
    }

    return response;
  };

  api.defaults.adapter = adapter;
}

beforeEach(() => {
  sent = undefined;
  sessionStorage.clear();
  history.replaceState(null, "", "/");
});

it("moves the token from the fragment to sessionStorage", () => {
  history.replaceState(null, "", "/canvas?x=1#token=abc");

  captureToken();

  expect(sessionStorage.getItem("lemmata-token")).toBe("abc");
  expect(location.pathname + location.search + location.hash).toBe(
    "/canvas?x=1",
  );
});

it("sends the captured token under /api", async () => {
  history.replaceState(null, "", "/#token=abc");
  captureToken();
  respond(200, { ok: true });

  await api.get("/health");

  expect(sent?.baseURL).toBe("/api");
  expect(sent?.headers.get("x-lemmata-token")).toBe("abc");
});

it("sends no token header when none is known (dev proxy adds it)", async () => {
  respond(200, []);

  await api.get("/projects");

  expect(sent?.headers.has("x-lemmata-token")).toBe(false);
});

it("throws the server's error message", async () => {
  respond(400, { error: "title: title is required" });

  await expect(api.post("/projects", {})).rejects.toEqual(
    new ApiError(400, "title: title is required"),
  );
});

it("explains an unreachable daemon behind the dev proxy", async () => {
  respond(502, "");

  await expect(api.get("/projects")).rejects.toEqual(
    new ApiError(502, "Can't reach the Lemmata daemon."),
  );
});
