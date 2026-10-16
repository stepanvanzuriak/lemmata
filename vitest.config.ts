import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*",
      {
        extends: "./apps/web/vite.config.ts",
        test: { name: "web", root: "./apps/web", environment: "happy-dom" },
      },
    ],
  },
});
