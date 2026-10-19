// Stands in for the `claude` binary in tests. FAKE_CLAUDE picks the script.
process.stderr.write(`argv ${JSON.stringify(process.argv.slice(2))}\n`);
process.stderr.write(
  `env ENABLE_TOOL_SEARCH=${process.env.ENABLE_TOOL_SEARCH ?? ""}\n`,
);

const line = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const init = { type: "system", subtype: "init", session_id: "fake-session" };

switch (process.env.FAKE_CLAUDE) {
  case "crash":
    line(init);
    process.stderr.write("boom: something broke\n");
    process.exit(2);
    break;
  case "hang":
    line(init);
    setInterval(() => {}, 1000);
    break;
  default:
    line(init);
    line({
      type: "assistant",
      message: {
        id: "msg_1",
        content: [{ type: "text", text: "OK" }],
        usage: { input_tokens: 10, output_tokens: 2 },
      },
    });
    line({ type: "result", subtype: "success" });
}
