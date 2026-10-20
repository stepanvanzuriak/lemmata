import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Canvas,
  CanvasDetail,
  CanvasNode,
  LiteraturePayload,
  Project,
} from "shared";
import { expect, it } from "vitest";
import { STUCK_NUDGE } from "../../chat.js";
import { authed, testApp } from "../helpers/app.js";
import { feedArxiv } from "../helpers/arxiv.js";
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
    feedArxiv,
  );
  const { app } = holder;
  const project = (await (
    await app.request(
      "/api/projects",
      json("POST", { title: "Orchard", statement: "Few rich lines." }),
    )
  ).json()) as Project;
  const [canvas] = (await (
    await app.request(`/api/canvases?projectId=${project.id}`, json("GET"))
  ).json()) as Canvas[];
  const base = `/api/canvases/${canvas!.id}`;
  const chat = async (text: string) =>
    parseSse(
      await (await app.request(`${base}/chat`, json("POST", { text }))).text(),
    );
  const detail = async () =>
    (await (await app.request(base, json("GET"))).json()) as CanvasDetail;

  return { app, agent, base, chat, detail };
}

const results: string[] = [];

/** First run makes H1 and a note; later runs act on the prompt. */
const script: Step = async (client, options) => {
  if (options.prompt === STUCK_NUDGE) {
    await callTool(client, "create_cards", {
      cards: [{ kind: "hypothesis", title: "Special case k=4" }],
    });
    return [{ type: "text", text: "Added a special case." }];
  }

  if (options.prompt === "start") {
    await callTool(client, "create_cards", {
      cards: [
        { kind: "hypothesis", title: "Quadratic many rich lines" },
        { kind: "note", title: "H1 attempts", connectFrom: "H1" },
        { kind: "note", title: "H1 correction", connectFrom: "H1" },
      ],
    });
    return [{ type: "text", text: "Set up." }];
  }

  if (options.prompt.startsWith("Check the literature")) {
    const card = options.prompt.match(/literature card (\w+)/)![1]!;
    const search = await callTool(client, "search_literature", {
      query: "rich lines",
    });
    const record = await callTool(client, "record_literature", {
      card,
      verdict: "partial",
      summary: "Green–Tao settle the ordinary-lines analogue.",
      suggestions: ["Restate H1 for k=3 using arXiv:1208.0053."],
      papers: [
        { id: "1208.0053", relevance: "Structure for few ordinary lines." },
      ],
    });
    const fake = await callTool(client, "record_literature", {
      card,
      verdict: "known",
      summary: "x",
      papers: [{ id: "9999.99999", relevance: "made up" }],
    });
    results.push(textOf(search), textOf(record), textOf(fake));
    return [{ type: "text", text: "Partial results are known." }];
  }

  if (options.prompt.startsWith("Reset this canvas")) {
    if (options.prompt.includes("write nothing")) {
      return [{ type: "text", text: "Nothing to keep." }];
    }
    await callTool(client, "create_cards", {
      cards: [
        { kind: "statement", title: "Canvas summary" },
        {
          kind: "hypothesis",
          title: "Quadratic many rich lines, sharpened",
          label: "H1",
        },
      ],
    });
    return [{ type: "text", text: "Kept two points." }];
  }

  if (options.prompt.startsWith("Tidy this canvas")) {
    await callTool(client, "create_cards", {
      cards: [{ kind: "note", title: "H1 summary", connectFrom: "H1" }],
    });
    results.push(
      textOf(
        await callTool(client, "archive_cards", {
          ids: ["H1 attempts", "H1 correction", "H1"],
          reason: "merged into H1 summary",
        }),
      ),
      textOf(await callTool(client, "read_canvas", {})),
    );
    return [{ type: "text", text: "Tidied." }];
  }

  results.push(
    textOf(
      await callTool(client, "archive_cards", { ids: ["H1"], reason: "x" }),
    ),
  );
  return [{ type: "text", text: "ok" }];
};

const titled = (nodes: CanvasNode[], title: string) =>
  nodes.find((n) => (n.payload as { title?: string }).title === title);

it("runs a literature check into a linked literature card, and reuses it", async () => {
  results.length = 0;
  const { agent, chat, detail } = await setup(script);
  await chat("start");

  const events = await chat("/literature H1 focus on k=4");
  const after = await detail();
  const card = after.nodes.find((n) => n.kind === "literature")!;
  const h1 = titled(after.nodes, "Quadratic many rich lines")!;
  const payload = card.payload as LiteraturePayload;

  expect(events[0]).toMatchObject({
    type: "user",
    run: { runKey: "literature", role: "literature", target: h1.id },
  });
  expect(events.at(-1)).toMatchObject({ type: "done", status: "done" });
  expect(agent.starts[1]!.prompt).toContain("User instructions: focus on k=4");
  expect(agent.starts[1]!.systemPromptAddendum).toContain("literature check");
  expect(results[0]).toContain(
    'arXiv:1208.0053 "On sets defining few ordinary lines"',
  );
  expect(results[2]).toContain("arXiv has no paper 9999.99999");
  expect(payload).toMatchObject({
    title: "Literature: H1",
    target: h1.id,
    verdict: "partial",
    markdown: "Green–Tao settle the ordinary-lines analogue.",
    suggestions: ["Restate H1 for k=3 using arXiv:1208.0053."],
    papers: [
      {
        id: "1208.0053",
        authors: ["Ben Green", "Terence Tao"],
        relevance: "Structure for few ordinary lines.",
      },
    ],
  });
  expect(after.edges).toContainEqual(
    expect.objectContaining({
      fromNode: h1.id,
      toNode: card.id,
      kind: "checked-by",
    }),
  );

  await chat(`/literature ${card.id}`);
  const again = await detail();
  expect(again.nodes.filter((n) => n.kind === "literature")).toHaveLength(1);
  expect(agent.starts[2]!.prompt).toContain('hypothesis H1 "Quadratic');
});

it("tidies: merges notes, archives dead ends, and the user restores them", async () => {
  results.length = 0;
  const { app, base, chat, detail } = await setup(script);
  await chat("start");
  const h1 = titled((await detail()).nodes, "Quadratic many rich lines")!;
  await app.request(
    `/api/nodes/${h1.id}`,
    json("PATCH", { status: "refuted" }),
  );

  const events = await chat("hello");
  expect(results[0]).toContain("Archived 1 card.");
  await app.request(`${base}/restore`, json("POST", {}));

  await chat("/tidy");
  const [archived, canvas] = results.slice(1);
  const after = await detail();
  const hidden = after.nodes.filter(
    (n) => (n.payload as { archived?: unknown }).archived,
  );

  expect(events.at(-1)).toMatchObject({ type: "done" });
  expect(archived).toBe("Archived 3 cards.");
  expect(canvas).toContain("3 archived cards are hidden");
  expect(canvas).toContain('"H1 summary"');
  expect(canvas).not.toContain('"H1 attempts"');
  expect(hidden).toHaveLength(3);

  const by = (hidden[0]!.payload as { archived: { by: string } }).archived.by;
  const restored = await (
    await app.request(`${base}/restore`, json("POST", { by }))
  ).json();
  expect(restored.restored).toHaveLength(3);
  expect(
    (await detail()).nodes.filter(
      (n) => (n.payload as { archived?: unknown }).archived,
    ),
  ).toHaveLength(0);
});

it("refuses archive_cards outside a tidy run", async () => {
  results.length = 0;
  const { app, base, chat } = await setup(script);
  await chat("start");
  await app.request(`${base}/agents`, json("POST", { role: "prover" }));
  await chat("/prover H1");

  expect(results[0]).toContain("Only a tidy run archives cards");
});

it("resets to key points: archives everything that was there, and labels resolve to the new cards", async () => {
  results.length = 0;
  const { app, agent, base, chat, detail } = await setup(script);
  await chat("start");

  const empty = await chat("/reset write nothing");
  expect(empty).toContainEqual(
    expect.objectContaining({
      type: "warning",
      message: expect.stringContaining("nothing was archived"),
    }),
  );
  expect(
    (await detail()).nodes.some(
      (n) => (n.payload as { archived?: unknown }).archived,
    ),
  ).toBe(false);

  await chat("/reset");
  const after = await detail();
  const visible = after.nodes.filter(
    (n) => !(n.payload as { archived?: unknown }).archived,
  );

  expect(agent.starts.at(-1)!.systemPromptAddendum).toContain("fresh start");
  expect(
    visible.map((n) => (n.payload as { title: string }).title).sort(),
  ).toEqual([
    "Canvas summary",
    "Orchard",
    "Quadratic many rich lines, sharpened",
  ]);
  expect(after.nodes).toHaveLength(6);

  const messages = async () =>
    (
      (await (await app.request(`${base}/messages`, json("GET"))).json()) as {
        text: string;
      }[]
    ).map((m) => m.text);
  expect(await messages()).toEqual(["/reset", "Kept two points."]);

  await app.request(`${base}/agents`, json("POST", { role: "prover" }));
  await chat("/prover H1");
  expect(agent.starts.at(-2)!.prompt).toContain("sharpened");

  const by = (
    after.nodes.find((n) => (n.payload as { archived?: unknown }).archived)!
      .payload as { archived: { by: string } }
  ).archived.by;
  const undo = await (
    await app.request(`${base}/restore`, json("POST", { by }))
  ).json();
  expect(undo.messages).toBe(4);
  expect((await messages())[0]).toBe("start");
});

it("gives a prover that changed nothing one more turn in the same session", async () => {
  results.length = 0;
  const { app, agent, base, chat, detail } = await setup(script);
  await chat("start");
  await app.request(`${base}/agents`, json("POST", { role: "prover" }));

  const events = await chat("/prover H1");
  const [first, nudge] = agent.starts.slice(-2);

  expect(nudge!.prompt).toBe(STUCK_NUDGE);
  expect(nudge!.resumeSessionId).toBe(first!.resumeSessionId ?? "session-2");
  expect(titled((await detail()).nodes, "Special case k=4")).toBeDefined();
  expect(events.at(-1)).toMatchObject({
    type: "done",
    message: { text: "ok\n\nAdded a special case." },
  });
});
