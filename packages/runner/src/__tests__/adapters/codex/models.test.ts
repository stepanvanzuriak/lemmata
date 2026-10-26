import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { listCodexModels } from "../../../adapters/codex/models.js";
import { codexArgs } from "../../../adapters/codex/args.js";

const fake = fileURLToPath(new URL("./fake-codex.mjs", import.meta.url));
const discover = (mode: string, timeoutMs = 2000) =>
  listCodexModels({
    command: process.execPath,
    commandArgs: [fake, mode],
    timeoutMs,
  });

it("discovers visible models across pages using CLI model slugs and labels", async () => {
  expect(await discover("pages")).toEqual([
    { id: "cli-model", label: "CLI Model" },
    { id: "another-model", label: "Another Model" },
  ]);
});

it("preserves an empty CLI catalog", async () => {
  expect(await discover("empty")).toEqual([]);
});

it.each([
  ["error", "no catalog"],
  ["crash", "catalog unavailable"],
  ["invalid", "Invalid Codex model/list response"],
  ["repeated", "repeated cursor"],
])(
  "rejects %s discovery without returning a partial catalog",
  async (mode, error) => {
    await expect(discover(mode)).rejects.toThrow(error);
  },
);

it("times out an unresponsive CLI", async () => {
  await expect(discover("hang", 100)).rejects.toThrow("Timed out");
});

it("reports a missing CLI", async () => {
  await expect(
    listCodexModels({ command: "/nonexistent/lemmata-codex" }),
  ).rejects.toThrow("ENOENT");
});

it.each(["cli-model", "gpt-5.3-codex", "gpt-5.4"])(
  "passes the selected model %s through to Codex",
  (id) => {
    const args = codexArgs({
      cwd: process.cwd(),
      prompt: "hi",
      model: { provider: "codex", id },
    });
    expect(
      args.slice(args.indexOf("--model"), args.indexOf("--model") + 2),
    ).toEqual(["--model", id]);
  },
);
