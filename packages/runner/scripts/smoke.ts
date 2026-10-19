import { ClaudeAdapter } from "../src/adapters/claude/index.js";
import type { RunEvent, StartOptions } from "../src/runner.js";

const backend = new ClaudeAdapter();
const model = { provider: "anthropic", id: "haiku" };

async function run(options: StartOptions) {
  let sessionId = "";
  let reply = "";
  let tokens = 0;

  for await (const event of backend.start(options)
    .events as AsyncIterable<RunEvent>) {
    if (event.type === "session") {
      sessionId = event.sessionId;
    }
    if (event.type === "text") {
      reply += event.text;
    }
    if (event.type === "usage") {
      const { input, output, cacheRead, cacheWrite } = event.usage;
      tokens += input + output + cacheRead + cacheWrite;
    }
    if (event.type === "error") {
      console.error("error:", event.message);
    }
  }

  console.log({ sessionId, reply, tokens });
  return sessionId;
}

const sessionId = await run({
  cwd: process.cwd(),
  prompt: "Reply with OK",
  model,
});
await run({
  cwd: process.cwd(),
  prompt: "What did you reply?",
  model,
  resumeSessionId: sessionId,
});
