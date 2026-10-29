import { expect, it } from "vitest";
import { mapCodexLine } from "../../../adapters/codex/messages.js";

it("books Codex cached input tokens as cache reads", () => {
  const events = mapCodexLine({
    type: "turn.completed",
    usage: { input_tokens: 1000, cached_input_tokens: 900, output_tokens: 5 },
  });

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "usage",
      usage: { input: 100, output: 5, cacheRead: 900, cacheWrite: 0 },
    }),
  );
});
