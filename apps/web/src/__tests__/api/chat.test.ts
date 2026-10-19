import { expect, it } from "vitest";
import { SseParser } from "../../api/chat";

it("parses events split across chunks", () => {
  const body =
    'event: text\ndata: {"type":"text","text":"Hel"}\n\n' +
    'event: usage\r\ndata: {"type":"usage","tokens":12}\r\n\r\n' +
    'event: done\ndata: {"type":"done","status":"done","message":null}\n\n';
  const parser = new SseParser();
  const events = [];

  // One character at a time, so "\r\n" pairs are split too.
  for (const char of body) {
    events.push(...parser.push(char));
  }

  expect(events).toEqual([
    { type: "text", text: "Hel" },
    { type: "usage", tokens: 12 },
    { type: "done", status: "done", message: null },
  ]);
});
