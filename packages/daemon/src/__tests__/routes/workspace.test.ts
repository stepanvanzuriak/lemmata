import { expect, it } from "vitest";
import { authed, testApp } from "../helpers/app.js";

it("reports the workspace, address and toolchain", async () => {
  const app = await testApp();
  const res = await app.request("/api/workspace", { headers: authed() });

  expect(await res.json()).toEqual({
    dir: "/tmp/ws",
    address: "127.0.0.1:4317",
    toolchain: {
      claude: "2.1.0 (Claude Code)",
      uv: null,
      python: "Python 3.12.4",
      lean: null,
    },
  });
});
