import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { mapClaudeLine } from "../../../adapters/claude/messages.js";

const lines = readFileSync(
  new URL("./fixtures/stream.jsonl", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as unknown);

it("maps a real CLI stream", () => {
  const seen = new Set<string>();
  const events = lines.flatMap((line) => mapClaudeLine(line, seen));

  expect(events.map((e) => e.type)).toEqual([
    "session",
    "tool_use",
    "usage",
    "tool_result",
    "text",
    "usage",
    "done",
  ]);
  expect(events[0]).toEqual({
    type: "session",
    sessionId: "3427545c-9b1b-4f13-8fb8-728ae6a51e33",
  });
  expect(events.find((e) => e.type === "tool_use")).toMatchObject({
    name: "Read",
  });
  expect(events.find((e) => e.type === "text")).toEqual({
    type: "text",
    text: "demo",
  });
  expect(events.at(-1)).toEqual({ type: "done", reason: "completed" });
});

it("counts usage for a repeated message id once", () => {
  const seen = new Set<string>();
  const assistant = lines[1];
  const first = mapClaudeLine(assistant, seen);
  const again = mapClaudeLine(assistant, seen);

  expect(first.filter((e) => e.type === "usage")).toHaveLength(1);
  expect(again.filter((e) => e.type === "usage")).toHaveLength(0);
  expect(first.find((e) => e.type === "usage")).toMatchObject({
    usage: { input: 2, output: 16, cacheRead: 1670, cacheWrite: 3066 },
  });
});

it("skips unknown lines", () => {
  const seen = new Set<string>();

  expect(mapClaudeLine(lines[2], seen)).toEqual([]); // rate_limit_event
  expect(mapClaudeLine("nonsense", seen)).toEqual([]);
  expect(mapClaudeLine({ type: "something_new" }, seen)).toEqual([]);
});
