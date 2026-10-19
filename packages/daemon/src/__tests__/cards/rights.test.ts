import type { CanvasNode } from "shared";
import { expect, it } from "vitest";
import { editRight } from "../../cards/rights.js";

const card = (
  kind: CanvasNode["kind"],
  createdBy: "user" | "ai",
  agentId?: string,
) =>
  ({
    kind,
    createdBy,
    payload: { title: "t", agentId },
  }) as unknown as CanvasNode;

it("lets an agent change everything on its own cards", () => {
  expect(
    editRight(card("note", "ai", "p1"), { role: "referee", agentId: "p1" }),
  ).toBe("all");
});

it("lets the assistant change any ai card", () => {
  expect(editRight(card("note", "ai", "other"), { role: "assistant" })).toBe(
    "all",
  );
  expect(editRight(card("note", "user"), { role: "assistant" })).toBe("none");
});

it("gives the prover status rights on others' hypotheses and the goal", () => {
  const prover = { role: "prover" as const, agentId: "p1" };

  expect(editRight(card("hypothesis", "user"), prover)).toBe("status");
  expect(editRight(card("goal", "user"), prover)).toBe("status");
  expect(editRight(card("statement", "user"), prover)).toBe("none");
});

it("gives the referee nothing it did not make", () => {
  const referee = { role: "referee" as const, agentId: "r1" };

  expect(editRight(card("hypothesis", "ai", "p1"), referee)).toBe("none");
  expect(editRight(card("goal", "user"), referee)).toBe("none");
});

it("refuses status-only callers other fields", async () => {
  const { canvasSetup } = await import("./helpers.js");
  const { updateCard } = await import("../../cards/apply.js");
  const { db, run } = await canvasSetup({ role: "prover", agentId: "p1" });

  await expect(updateCard(db, run, "goal", { text: "x" })).rejects.toThrow(
    "You may only change the status",
  );
  const goal = await updateCard(db, run, "goal", { status: "proved" });
  expect(goal.payload).toMatchObject({ status: "proved" });
});
