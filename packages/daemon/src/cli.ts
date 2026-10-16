import { resolve } from "node:path";
import { Command, InvalidArgumentError, Option } from "commander";
import { initWorkspace, MIGRATIONS_FOLDER } from "core";
import open from "open";
import { startServer } from "./server.js";
import { TOKEN_PATTERN } from "./security.js";

type ServeOptions = {
  port: number;
  token?: string;
  origin?: string[];
  static?: string;
  open: boolean;
  exitWithParent?: boolean;
};

const workspaceDir = (dir?: string) =>
  resolve(dir ?? process.env.LEMMATA_WORKSPACE ?? ".");

async function serve(dir: string | undefined, options: ServeOptions) {
  const server = await startServer({
    workspace: workspaceDir(dir),
    port: options.port,
    token: options.token,
    allowedOrigins: options.origin,
    staticDir: options.static,
  });

  console.log(`LEMMATA_URL=${server.url}`);

  if (options.open) {
    open(server.url).catch(() =>
      console.error(`Open ${server.url} in your browser.`),
    );
  }

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (options.exitWithParent) {
    const parent = process.ppid;

    setInterval(() => {
      if (process.ppid !== parent) {
        shutdown().catch(() => process.exit(1));
      }
    }, 1000).unref();
  }
}

const program = new Command("lemmata").description(
  "Local research canvas daemon.",
);

program
  .command("init")
  .description("create a workspace")
  .argument("[dir]", "workspace folder (default: $LEMMATA_WORKSPACE or .)")
  .action(async (dir?: string) => {
    const root = workspaceDir(dir);

    await initWorkspace(root, MIGRATIONS_FOLDER);
    console.log(`Workspace ready in ${root}`);
  });

program
  .command("serve")
  .description("serve the API (and optionally the web app) on 127.0.0.1")
  .argument("[dir]", "workspace folder (default: $LEMMATA_WORKSPACE or .)")
  .addOption(
    new Option("--port <n>", "port; 0 picks a free one")
      .env("LEMMATA_PORT")
      .default(4317)
      .argParser(Number),
  )
  .addOption(
    new Option("--token <token>", "API token (default: random)")
      .env("LEMMATA_TOKEN")
      .argParser((token: string) => {
        if (!TOKEN_PATTERN.test(token)) {
          throw new InvalidArgumentError(
            "use letters, digits and . _ ~ + / - only",
          );
        }

        return token;
      }),
  )
  .option("--origin <url...>", "extra allowed origins")
  .option("--static <dir>", "serve a built web app from this folder")
  .option("--no-open", "do not open the browser")
  .option("--exit-with-parent", "exit when the parent process dies")
  .action(serve);

await program.parseAsync();
