import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunEvent } from "runner";
import type {
  Canvas,
  CanvasAgent,
  ChatEvent,
  ChatMessage,
  Project,
} from "shared";
import { expect, it } from "vitest";
import { authed, testApp } from "../helpers/app.js";
import {
  callTool,
  parseSse,
  ScriptedAgent,
  textOf,
  type App,
  type Step,
} from "../helpers/mcp.js";

const json = (method: string, body?: unknown) => ({
  method,
  headers: authed({ "content-type": "application/json" }),
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function setup(step: Step) {
  const holder = {} as { app: App };
  const agent = new ScriptedAgent(() => holder.app, step);
  holder.app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-ws-")),
    () => agent,
  );
  const { app } = holder;

  const project = (await (
    await app.request(
      "/api/projects",
      json("POST", { title: "Collatz", statement: "Orbits reach 1." }),
    )
  ).json()) as Project;
  const [canvas] = (await (
    await app.request(`/api/canvases?projectId=${project.id}`, json("GET"))
  ).json()) as Canvas[];
  const base = `/api/canvases/${canvas!.id}`;
  const chat = async (text: string, model?: string) => {
    const res = await app.request(
      `${base}/chat`,
      json("POST", { text, model }),
    );
    return {
      res,
      events: res.status === 200 ? parseSse(await res.text()) : [],
    };
  };

  return { app, agent, base, chat };
}

/** Creates H1 and H2 on the first run, then just replies. */
const createThenReply: Step = async (client, options) => {
  if (options.prompt !== "make hypotheses") {
    return [{ type: "text", text: "Looked at it." }];
  }
  const result = await callTool(client, "create_cards", {
    cards: [
      { kind: "hypothesis", title: "Small orbits" },
      { kind: "hypothesis", title: "Large orbits" },
    ],
  });
  return [
    { type: "text", text: "Adding two hypotheses. " },
    { type: "tool_use", id: "t1", name: "create_cards", input: {} },
    { type: "tool_result", id: "t1", output: textOf(result), isError: false },
    {
      type: "usage",
      messageId: "m1",
      usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 },
    },
    { type: "text", text: "Done." },
  ] satisfies RunEvent[];
};

it("streams events in order with the new cards", async () => {
  const { chat } = await setup(createThenReply);
  const { res, events } = await chat("make hypotheses");

  expect(res.headers.get("content-type")).toContain("text/event-stream");
  expect(events.map((e) => e.type)).toEqual([
    "user",
    "text",
    "tool_use",
    "cards",
    "usage",
    "text",
    "done",
  ]);
  const cards = events.find((e) => e.type === "cards") as Extract<
    ChatEvent,
    { type: "cards" }
  >;
  expect(
    cards.nodes.map((n) => (n.payload as { label?: string }).label),
  ).toEqual(["H1", "H2"]);
  expect(cards.edges).toHaveLength(2);
  expect(events.at(-1)).toMatchObject({
    type: "done",
    status: "done",
    message: { role: "assistant", text: "Adding two hypotheses. Done." },
  });
});

it("stores the typed command, resumes per target and claims while running", async () => {
  const seen: string[] = [];
  const { app, agent, base, chat } = await setup(async (client, options) => {
    if (options.prompt === "make hypotheses") {
      return createThenReply(client, options);
    }
    seen.push(textOf(await callTool(client, "get_card", { id: "H1" })));
    return [{ type: "text", text: "Working." }];
  });
  await chat("make hypotheses");
  await app.request(
    `${base}/agents`,
    json("POST", { role: "prover", model: "haiku" }),
  );

  await chat("/prover H1 try induction");
  await chat("/prover H1");
  await chat("/prover H2");

  const prover = agent.starts.slice(1);
  expect(prover[0]!.prompt).toContain('Work on hypothesis H1 "Small orbits"');
  expect(prover[0]!.prompt).toContain("User instructions: try induction");
  expect(prover[0]!.resumeSessionId).toBeUndefined();
  expect(prover[1]!.resumeSessionId).toBe("session-2");
  expect(prover[2]!.resumeSessionId).toBeUndefined();
  expect(prover[0]!.model).toEqual({ provider: "scripted", id: "haiku" });
  expect(seen[0]).toContain("status: Prover working");

  const messages = (await (
    await app.request(`${base}/messages`, json("GET"))
  ).json()) as ChatMessage[];
  expect(messages.filter((m) => m.role === "user").map((m) => m.text)).toEqual([
    "make hypotheses",
    "/prover H1 try induction",
    "/prover H1",
    "/prover H2",
  ]);
  const detail = await (await app.request(base, json("GET"))).json();
  expect(
    detail.nodes.find(
      (n: { payload: { label?: string } }) => n.payload.label === "H1",
    ).payload.status,
  ).toBe("open");
});

it("answers 409 without an agent, for an unknown target and while busy", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { app, base, chat } = await setup(async () => {
    await gate;
    return [{ type: "text", text: "ok" }];
  });

  expect((await chat("/prover H1")).res.status).toBe(409);
  await app.request(`${base}/agents`, json("POST", { role: "prover" }));
  const unknown = await chat("/prover H9");
  expect(unknown.res.status).toBe(409);
  expect(await unknown.res.json()).toMatchObject({ code: "no_target" });

  const first = app.request(`${base}/chat`, json("POST", { text: "hi" }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  const busy = await app.request(
    `${base}/chat`,
    json("POST", { text: "again" }),
  );
  expect(busy.status).toBe(409);
  expect(await busy.json()).toMatchObject({ code: "busy" });
  expect(await (await app.request(`${base}/runs`, json("GET"))).json()).toEqual(
    ["assistant"],
  );

  release();
  await (await first).text();
});

it("aborts a run", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { app, base } = await setup(async () => {
    await gate;
    return [{ type: "text", text: "late" }];
  });

  const running = app.request(`${base}/chat`, json("POST", { text: "hi" }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  const aborted = await app.request(
    `${base}/chat/abort?agent=assistant`,
    json("POST"),
  );
  expect(await aborted.json()).toEqual({ aborted: 1 });

  release();
  const events = parseSse(await (await running).text());
  expect(events.at(-1)).toMatchObject({ type: "done", status: "aborted" });
});

it("uses the requested model for the Assistant and lists the adapter's models", async () => {
  const { app, agent, chat } = await setup(async () => []);

  await chat("hello", "fast");

  expect(agent.starts[0]!.model).toEqual({ provider: "scripted", id: "fast" });
  expect(await (await app.request("/api/models", json("GET"))).json()).toEqual([
    { id: "fast", label: "Fast" },
  ]);
});

it("manages agents", async () => {
  const { app, base } = await setup(async () => []);

  const created = await app.request(
    `${base}/agents`,
    json("POST", { role: "referee", tokenCap: 50_000 }),
  );
  expect(created.status).toBe(201);
  const agent = (await created.json()) as CanvasAgent;
  expect(
    (await app.request(`${base}/agents`, json("POST", { role: "referee" })))
      .status,
  ).toBe(409);

  const patched = await app.request(
    `${base}/agents/${agent.id}`,
    json("PATCH", { model: "opus" }),
  );
  expect(await patched.json()).toMatchObject({
    model: "opus",
    tokenCap: 50_000,
  });
  expect(
    (await app.request(`${base}/agents/${agent.id}`, json("DELETE"))).status,
  ).toBe(200);
  expect(
    await (await app.request(`${base}/agents`, json("GET"))).json(),
  ).toEqual([]);
});
