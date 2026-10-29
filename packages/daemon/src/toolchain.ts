import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Toolchain } from "shared";
import type { RunCommand } from "./exec.js";

function version(command: string, args = ["--version"]) {
  return new Promise<string | null>((done) => {
    execFile(command, args, { timeout: 5000 }, (error, stdout, stderr) => {
      const line = `${stdout}${stderr}`.trim().split("\n")[0];

      done(error || !line ? null : line);
    });
  });
}

export async function detectToolchain(): Promise<Toolchain> {
  const [claude, uv, python, lean] = await Promise.all([
    version("claude"),
    version("uv"),
    version("python3"),
    version("lean"),
  ]);

  return { claude, uv, python, lean };
}

export function pythonCommand(toolchain: Toolchain) {
  if (toolchain.uv) {
    return {
      cmd: "uv",
      args: [
        "run",
        "--no-project",
        "--quiet",
        "--with",
        "numpy",
        "--with",
        "sympy",
        "--with",
        "matplotlib",
        "--with",
        "manim",
        "python",
      ],
    };
  }

  return { cmd: "python3", args: [] };
}

export function warmPython(toolchain: Toolchain) {
  const { cmd, args } = pythonCommand(toolchain);

  execFile(cmd, [...args, "-c", "import numpy, sympy, matplotlib, manim"], {
    timeout: 10 * 60_000,
  });
}

const cacheRoot = () =>
  join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "lemmata");

export const mathlibDir = () => join(cacheRoot(), "checks");
const mathlibReady = () => join(mathlibDir(), ".lemmata-ready");

export function leanCommand(): RunCommand {
  if (existsSync(mathlibReady())) {
    return { cmd: "lake", args: ["env", "lean"], cwd: mathlibDir() };
  }

  return { cmd: "lean", args: [] };
}

function run(cmd: string, args: string[], cwd: string) {
  return new Promise<void>((done, fail) => {
    execFile(
      cmd,
      args,
      { cwd, timeout: 30 * 60_000, maxBuffer: 64 * 1024 * 1024 },
      (error) => (error ? fail(error) : done()),
    );
  });
}

export async function warmLean(toolchain: Toolchain) {
  if (!toolchain.lean || existsSync(mathlibReady())) {
    return;
  }

  try {
    await mkdir(cacheRoot(), { recursive: true });
    if (!existsSync(join(mathlibDir(), "lakefile.toml"))) {
      await run(
        "lake",
        [
          "+leanprover-community/mathlib4:lean-toolchain",
          "new",
          "checks",
          "math",
        ],
        cacheRoot(),
      );
    }
    await run("lake", ["exe", "cache", "get"], mathlibDir());
    await writeFile(mathlibReady(), "");
  } catch {
    // Lean cards keep running with core Lean; the next start tries again.
  }
}
