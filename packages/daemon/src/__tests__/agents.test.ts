import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addAgent,
  addNode,
  createProject,
  getCanvas,
  initWorkspace,
  listCanvases,
  MIGRATIONS_FOLDER,
  parsePayload,
} from "core";
import { expect, it } from "vitest";
import { claim, ConflictError, parseCommand, release } from "../agents.js";
import { loadDetail } from "../cards/load.js";
import { startServer } from "../server.js";

it.each([
  ["/prover H1", { role: "prover", ref: "H1", instructions: "" }],
  [
    "/referee goal check step 2",
    { role: "referee", ref: "goal", instructions: "check step 2" },
  ],
  [
    "  /prover 01ABC\ntry induction",
    { role: "prover", ref: "01ABC", instructions: "try induction" },
  ],
])("parses %j", (text, command) => {
  expect(parseCommand(text)).toEqual(command);
});

it.each(["hello", "/prover", "/assistant H1", "prover H1"])(
  "treats %j as a plain message",
  (text) => {
    expect(parseCommand(text)).toBeNull();
  },
);

async function setup(dir = ":memory:") {
  const db =
    dir === ":memory:"
      ? await (await import("core")).openDb(dir, MIGRATIONS_FOLDER)
      : await initWorkspace(dir, MIGRATIONS_FOLDER);
  const project = await createProject(db, { title: "P" });
  const [canvas] = await listCanvases(db, project.id);
  const canvasId = canvas!.id;
  const node = await addNode(db, {
    canvasId,
    kind: "hypothesis",
    payload: { title: "H", label: "H1", status: "open" },
  });
  const prover = await addAgent(db, { canvasId, role: "prover" });
  const referee = await addAgent(db, { canvasId, role: "referee" });
  const card = async () =>
    (await loadDetail(db, canvasId)).nodes.find((n) => n.id === node.id)!;

  return { db, canvasId, node, prover, referee, card };
}

it("claims and releases a hypothesis", async () => {
  const { db, prover, card } = await setup();

  await claim(db, await card(), prover);
  expect((await card()).payload).toMatchObject({
    status: "claimed",
    claimedBy: prover.id,
    claimedByRole: "prover",
  });

  await release(db, (await card()).id, prover);
  expect((await card()).payload).toEqual({
    title: "H",
    label: "H1",
    status: "open",
  });
});

it("refuses a second agent's claim", async () => {
  const { db, prover, referee, card } = await setup();

  await claim(db, await card(), prover);
  await expect(claim(db, await card(), referee)).rejects.toBeInstanceOf(
    ConflictError,
  );
});

it("clears claims when the daemon starts", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  const { db, prover, card, canvasId } = await setup(workspace);
  await claim(db, await card(), prover);
  db.$client.close();

  const server = await startServer({ workspace, port: 0, token: "t" });
  await server.close();

  const reopened = await initWorkspace(workspace, MIGRATIONS_FOLDER);
  const [node] = (await getCanvas(reopened, canvasId))!.nodes.filter(
    (n) => n.kind === "hypothesis",
  );
  expect(parsePayload(node!.payload)).toEqual({
    title: "H",
    label: "H1",
    status: "open",
  });
});
