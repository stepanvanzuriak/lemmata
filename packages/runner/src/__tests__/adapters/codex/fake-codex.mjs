import assert from "node:assert/strict";
import { createInterface } from "node:readline";

const mode = process.argv[2];
assert.equal(process.argv[3], "app-server");
let initialized = false;
let acknowledged = false;
const reply = (id, result) => console.log(JSON.stringify({ id, result }));

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (mode === "hang") {
    return;
  }
  if (mode === "crash") {
    console.error("catalog unavailable");
    process.exit(1);
  }
  if (message.method === "initialize") {
    assert.equal(message.params.clientInfo.name, "lemmata");
    initialized = true;
    reply(message.id, {});
  } else if (message.method === "initialized") {
    assert.ok(initialized);
    acknowledged = true;
  } else if (message.method === "model/list") {
    assert.ok(acknowledged);
    assert.equal(message.params.includeHidden, false);
    if (mode === "error") {
      console.log(
        JSON.stringify({ id: message.id, error: { message: "no catalog" } }),
      );
    } else if (mode === "invalid") {
      reply(message.id, { data: [{ id: "missing-model-slug" }] });
    } else if (mode === "empty") {
      reply(message.id, { data: [], nextCursor: null });
    } else if (!message.params.cursor || mode === "repeated") {
      console.log("CLI warning");
      console.log(JSON.stringify({ method: "notification", params: {} }));
      reply(message.id, {
        data: [
          { id: "catalog-id", model: "cli-model", displayName: "CLI Model" },
          { model: "hidden-model", displayName: "Hidden", hidden: true },
        ],
        nextCursor: "page-two",
      });
    } else {
      assert.equal(message.params.cursor, "page-two");
      reply(message.id, {
        data: [{ model: "another-model", displayName: "Another Model" }],
        nextCursor: null,
      });
    }
  }
});
