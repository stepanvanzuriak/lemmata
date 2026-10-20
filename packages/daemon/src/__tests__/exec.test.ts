import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  MAX_OUTPUT,
  parseLeanOutput,
  runLean,
  runProcess,
  runPython,
} from "../exec.js";
import { STUB_PYPLOT } from "./helpers/matplotlib.js";

const python = { cmd: "python3", args: [] };
const hasLean = (() => {
  try {
    execFileSync("lean", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

afterEach(() => {
  delete process.env.SECRET_X;
});

it("captures the exit code", async () => {
  const result = await runProcess("sh", ["-c", "echo hi; exit 3"]);

  expect(result).toMatchObject({
    stdout: "hi\n",
    exitCode: 3,
    timedOut: false,
  });
});

it("kills a process that passes its timeout", async () => {
  const result = await runProcess("sleep", ["10"], { timeoutMs: 200 });

  expect(result.timedOut).toBe(true);
  expect(result.durationMs).toBeLessThan(2000);
});

it("truncates output past the limit", async () => {
  const result = await runProcess("sh", ["-c", "yes x | head -c 400000"]);

  expect(result.stdout.length).toBeLessThan(MAX_OUTPUT + 100);
  expect(result.stdout).toContain("[output truncated]");
});

it("drops secrets from an isolated environment", async () => {
  process.env.SECRET_X = "leak";
  const open = await runProcess("sh", ["-c", "echo $SECRET_X"]);
  const isolated = await runProcess("sh", ["-c", "echo $SECRET_X"], {
    isolated: true,
  });

  expect(open.stdout.trim()).toBe("leak");
  expect(isolated.stdout.trim()).toBe("");
});

it("runs python and reports stdout", async () => {
  const result = await runPython("print(1+2)", python);

  expect(result).toMatchObject({ stdout: "3\n", exitCode: 0 });
});

it("reports a python exit code", async () => {
  const result = await runPython("raise SystemExit(3)", python);

  expect(result.exitCode).toBe(3);
});

it("hides the temp path in python tracebacks", async () => {
  const result = await runPython("1/0", python);

  expect(result.stderr).toContain("<card>");
  expect(result.stderr).not.toContain("lemmata-py-");
  expect(result.stderr).not.toContain("runpy");
});

it("parses lean errors, sorry and axioms", () => {
  const report = parseLeanOutput(
    [
      "<card>:1:8: warning: declaration uses `sorry`",
      "<card>:5:19: error: unsolved goals",
      "⊢ False",
      "'foo' depends on axioms: [propext, sorryAx, bad]",
    ].join("\n"),
  );

  expect(report.diagnostics).toEqual([
    {
      line: 1,
      column: 8,
      severity: "warning",
      message: "declaration uses `sorry`",
    },
    {
      line: 5,
      column: 19,
      severity: "error",
      message: "unsolved goals\n⊢ False",
    },
  ]);
  expect(report.hasSorry).toBe(true);
  expect(report.axioms).toEqual(["propext", "sorryAx", "bad"]);
  expect(report.extraAxioms).toEqual(["bad"]);
});

it("parses a clean lean run", () => {
  const report = parseLeanOutput("'baz' does not depend on any axioms\n");

  expect(report).toEqual({
    diagnostics: [],
    axioms: [],
    hasSorry: false,
    extraAxioms: [],
  });
});

it.skipIf(!hasLean)(
  "checks a real lean theorem",
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "lemmata-lean-"));
    const { output, report } = await runLean(
      "theorem two : 1 + 1 = 2 := rfl",
      dir,
    );

    expect(output.exitCode).toBe(0);
    expect(report.hasSorry).toBe(false);
    expect(report.extraAxioms).toEqual([]);
  },
  60_000,
);

it("saves open figures into outDir even when the card raises", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "lemmata-fig-"));
  const result = await runPython(
    `${STUB_PYPLOT}\nplt._plot(1, title="Saddle")\nplt._plot(2)\nraise ValueError("boom")`,
    python,
    { outDir },
  );
  const figures = JSON.parse(
    await readFile(join(outDir, "figures.json"), "utf8"),
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("ValueError: boom");
  expect(await readdir(outDir)).toEqual(
    expect.arrayContaining(["fig-1.png", "fig-2.png"]),
  );
  expect(figures).toEqual([
    { name: "fig-1.png", title: "Saddle", is3d: false, views: null },
    { name: "fig-2.png", title: null, is3d: false, views: null },
  ]);
});

it("writes nothing when matplotlib was never imported", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "lemmata-fig-"));

  await runPython("print(1)", python, { outDir });

  expect(await readdir(outDir)).toEqual([]);
});

it("renders a 3D figure from four angles", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "lemmata-fig-"));

  await runPython(`${STUB_PYPLOT}\nplt._plot(1, "3d")`, python, { outDir });
  const figures = JSON.parse(
    await readFile(join(outDir, "figures.json"), "utf8"),
  );

  expect(figures[0]).toMatchObject({ is3d: true, views: "fig-1-views.png" });
  expect(await readdir(outDir)).toContain("fig-1-views.png");
});

it("keeps the first 8 figures and says so", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "lemmata-fig-"));
  const result = await runPython(
    `${STUB_PYPLOT}\nfor n in range(1, 11): plt._plot(n)`,
    python,
    { outDir },
  );
  const figures = JSON.parse(
    await readFile(join(outDir, "figures.json"), "utf8"),
  );

  expect(figures).toHaveLength(8);
  expect(result.stderr).toContain("only the first 8 figures were saved");
});

const hasMatplotlib = (() => {
  try {
    execFileSync("python3", ["-c", "import matplotlib, PIL"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
})();

it.skipIf(!hasMatplotlib)("draws a real 3D surface", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "lemmata-fig-"));
  const result = await runPython(
    [
      "import numpy as np, matplotlib.pyplot as plt",
      "x, y = np.meshgrid(np.linspace(-1, 1, 20), np.linspace(-1, 1, 20))",
      'ax = plt.figure().add_subplot(projection="3d")',
      "ax.plot_surface(x, y, x**2 - y**2)",
    ].join("\n"),
    python,
    { outDir },
  );
  const { width, height } = await new Promise<{
    width: number;
    height: number;
  }>((done) => {
    const png = readFileSync(join(outDir, "fig-1-views.png"));
    done({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
  });

  expect(result.exitCode).toBe(0);
  expect(width / height).toBeGreaterThan(3.6);
  expect(width / height).toBeLessThan(4.4);
  expect(readFileSync(join(outDir, "fig-1.png")).length).toBeGreaterThan(0);
});
