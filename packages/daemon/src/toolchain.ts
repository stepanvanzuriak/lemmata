import { execFile } from "node:child_process";
import type { Toolchain } from "shared";

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
