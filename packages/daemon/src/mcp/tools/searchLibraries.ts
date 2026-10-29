import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { ToolRefusal } from "../../cards/types.js";
import { runProcess } from "../../exec.js";
import {
  describeHits,
  entryCount,
  kindOf,
  leanIndex,
  moduleOf,
  searchEntries,
  searchModules,
  searchRegex,
  type LeanEntry,
  type LeanRoot,
} from "../../search/leanIndex.js";
import {
  DEFAULT_LIBS,
  pythonDoc,
  pythonIndex,
  searchPython,
} from "../../search/pythonIndex.js";
import { leanCommand, mathlibDir } from "../../toolchain.js";
import { guard, type RegisterTool } from "./shared.js";

const SKIPPED_PACKAGES = new Set(["Cli", "importGraph", "proofwidgets"]);

let rootsCache: Promise<LeanRoot[]> | undefined;

/** Resolved once Mathlib is installed; before that, looked up again each call. */
function leanRoots(): Promise<LeanRoot[]> {
  rootsCache ??= findLeanRoots().then((roots) => {
    if (roots.length < 2) {
      rootsCache = undefined;
    }
    return roots;
  });
  return rootsCache;
}

/** At most two Mathlib-importing Lean processes at once. */
let running = 0;
const waiting: (() => void)[] = [];

async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (running >= 2) {
    await new Promise<void>((go) => waiting.push(go));
  }
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function findLeanRoots(): Promise<LeanRoot[]> {
  const roots: LeanRoot[] = [];
  const packages = join(mathlibDir(), ".lake", "packages");
  const prefix = await runProcess("lean", ["--print-prefix"], {
    timeoutMs: 10_000,
  });

  if (prefix.exitCode === 0) {
    roots.push({ dir: join(prefix.stdout.trim(), "src", "lean") });
  }
  if (existsSync(packages)) {
    for (const name of await readdir(packages)) {
      if (!SKIPPED_PACKAGES.has(name)) {
        roots.push({ dir: join(packages, name) });
      }
    }
  }
  return roots;
}

const describe = (e: LeanEntry) =>
  `- ${e.kind} ${e.name} (${e.module}:${e.line})\n  ${e.signature}${e.doc ? `\n  -- ${e.doc.slice(0, 200)}` : ""}`;

/** Runs a throwaway file through the same Lean (and Mathlib) the checks use. */
async function runLeanSnippet(source: string, timeoutMs: number) {
  return limited(() => runLeanFile(source, timeoutMs));
}

async function runLeanFile(source: string, timeoutMs: number) {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-search-"));

  try {
    const file = join(dir, "Search.lean");
    const { cmd, args, cwd } = leanCommand();

    await writeFile(file, source);
    const out = await runProcess(cmd, [...args, file], { cwd, timeoutMs });

    // The file is deleted afterwards; keep agents from hunting for it.
    return out.timedOut
      ? `Timed out after ${timeoutMs / 1000}s.`
      : `${out.stdout}${out.stderr}`.replaceAll(file, "<query>").trim() ||
          "(no output)";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const registerSearchLibraries: RegisterTool = (
  server,
  { toolchain },
) => {
  server.registerTool(
    "search_lean",
    {
      description: [
        "Search the Lean 4 libraries installed for checks: Mathlib, Batteries, Aesop, Qq and the Lean core (Init, Std, Lean). Use it before writing a Lean proof, and before concluding that a lemma is missing; Mathlib names are systematic, so rephrase and try several modes.",
        "mode name (default): every word of the query must occur in a declaration's name, signature or docstring; name matches rank first. Words are split on case and underscores, so `Nat sub add cancel` finds Nat.sub_add_cancel and `tendsto atTop` finds Filter.Tendsto lemmas. Name pieces follow the statement: mul, add, sub, le, lt, eq, ne, pos, nonneg, zero, one, of (implies), iff, comm, assoc, cancel, self.",
        "mode regex: a JavaScript regular expression tested against names and signatures, for exact shapes such as `^Finset\\.sum_.*comm`.",
        "mode module: find files by path or module docstring (`Analysis SpecialFunctions Log`), then query their contents with the module's name as a name-mode word.",
        "mode check: pass an exact declaration name; Lean prints its real elaborated type (`#check @name`) with implicit arguments, after instances and notation are resolved. Use it to confirm a hit before relying on it.",
        "mode exact or apply: pass a goal as a Lean proposition (e.g. `∀ a b : ℕ, a + b = b + a`); runs `exact?` or `apply?` against all of Mathlib, which finds lemmas by statement rather than by name. Slow (up to a few minutes); results are suggestions to verify with run_card.",
        "mode source: pass an exact declaration name; returns its file, line and source text (the proof too, up to 150 lines), so you can read how Mathlib proves something or what a definition unfolds to. You cannot read files yourself; use this instead of shell commands.",
        "Results list kind, qualified name, module, line, signature and docstring, 25 per page (use offset). The scan is textual; a declaration made by a macro may be missing, so confirm absence with mode exact or check before giving up.",
      ].join(" "),
      inputSchema: {
        query: z.string().trim().min(1).max(2000),
        mode: z
          .enum([
            "name",
            "regex",
            "module",
            "source",
            "check",
            "exact",
            "apply",
          ])
          .default("name"),
        kind: z
          .enum([
            "theorem",
            "def",
            "abbrev",
            "structure",
            "class",
            "inductive",
            "instance",
            "axiom",
            "opaque",
          ])
          .optional()
          .describe("Only declarations of this kind (name and regex modes)."),
        module: z
          .string()
          .trim()
          .optional()
          .describe(
            "Only declarations whose module starts with this prefix, e.g. Mathlib.Analysis (name and regex modes).",
          ),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true },
    },
    ({ query, mode, kind, module, limit, offset }) =>
      guard(async () => {
        if (!(await toolchain).lean) {
          throw new ToolRefusal("Lean is not installed on this machine.");
        }
        if (mode === "source") {
          const index = await leanIndex(await leanRoots());
          const ids = index.names.flatMap((name, id) =>
            name === query || name.endsWith(`.${query}`) ? [id] : [],
          );
          const found = await describeHits(index, ids.slice(0, 3));

          if (ids.length === 0) {
            throw new ToolRefusal(
              `No declaration named "${query}". Search by name first; source needs the exact name.`,
            );
          }
          return (
            await Promise.all(
              found.slice(0, 3).map(async (e) => {
                const lines = (await readFile(e.file, "utf8")).split("\n");
                let next = Infinity;

                for (let id = 0; id < index.names.length; id++) {
                  const line = index.lines[id]!;

                  if (
                    index.files[index.fileOf[id]!]!.path === e.file &&
                    line > e.line &&
                    line < next
                  ) {
                    next = line;
                  }
                }
                const end = Math.min(next - 1, e.line - 1 + 150, lines.length);

                return `-- ${e.name} (${e.module}, line ${e.line})\n${lines
                  .slice(e.line - 1, end)
                  .join("\n")
                  .trimEnd()}`;
              }),
            )
          ).join("\n\n");
        }
        if (mode === "check") {
          return runLeanSnippet(
            `import Mathlib\nset_option pp.fieldNotation.generalized false\n#check @${query}\n#print axioms ${query}`,
            120_000,
          );
        }
        if (mode === "exact" || mode === "apply") {
          return runLeanSnippet(
            `import Mathlib\nexample : ${query} := by\n  ${mode}?`,
            300_000,
          );
        }

        const roots = await leanRoots();
        const index = await leanIndex(roots);

        if (entryCount(index) === 0) {
          throw new ToolRefusal(
            "No Lean sources found. Mathlib is not installed yet; search again after the first Lean check has finished setting it up.",
          );
        }
        if (mode === "module") {
          const modules = searchModules(index, query);

          return [
            `${modules.length} modules match "${query}"${modules.length > limit ? `; showing ${offset + 1}-${Math.min(modules.length, offset + limit)}` : ""}:`,
            ...modules
              .slice(offset, offset + limit)
              .map(
                (m) =>
                  `- ${m.module}${m.doc ? ` -- ${m.doc.slice(0, 200)}` : ""}`,
              ),
          ].join("\n");
        }

        let hits;

        if (mode === "regex") {
          try {
            hits = searchRegex(index, new RegExp(query));
          } catch (error) {
            throw new ToolRefusal(
              `Invalid regular expression: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        } else {
          hits = searchEntries(index, query);
        }
        hits = hits.filter(
          (h) =>
            (!kind || kindOf(index, h.id) === kind) &&
            (!module || moduleOf(index, h.id).startsWith(module)),
        );
        if (hits.length === 0) {
          return `No declarations match "${query}" (${entryCount(index)} indexed). Try fewer or synonymous words, mode regex, or mode exact with the statement.`;
        }
        const next = offset + limit;

        return [
          `${hits.length} declarations match "${query}"${hits.length > limit ? `; showing ${offset + 1}-${Math.min(hits.length, next)}` : ""}:`,
          ...(
            await describeHits(
              index,
              hits.slice(offset, next).map((h) => h.id),
            )
          ).map(describe),
          ...(next < hits.length
            ? [`More results: call again with offset ${next}.`]
            : []),
        ].join("\n");
      }),
  );

  server.registerTool(
    "search_python",
    {
      description: [
        `Search the Python libraries available to python cards (${DEFAULT_LIBS.join(", ")}, or the libs you name) by reading their source without importing it, so every module, class, function and method is covered. Use it to find the right API before writing code.`,
        "mode search (default): every query word must occur in a qualified name, signature or docstring; name matches rank first (`sympy ntheory factor`, `matplotlib 3d surface`, `numpy cumulative sum`).",
        "Names are where the code is defined (numpy._core.fromnumeric.cumulative_sum); users usually import them from the package root (numpy.cumulative_sum).",
        "mode doc: pass an exact dotted name (`sympy.ntheory.factor_.factorint`); returns the live signature and full docstring from the installed version.",
        "25 results per page (use offset). Libraries beyond the defaults are searched only if installed in the check environment.",
      ].join(" "),
      inputSchema: {
        query: z.string().trim().min(1).max(500),
        mode: z.enum(["search", "doc"]).default("search"),
        libs: z
          .array(z.string().regex(/^[A-Za-z_][\w]*$/))
          .max(20)
          .optional(),
        kind: z.enum(["module", "class", "function", "method"]).optional(),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true },
    },
    ({ query, mode, libs, kind, limit, offset }) =>
      guard(async () => {
        const chain = await toolchain;

        if (mode === "doc") {
          try {
            return await pythonDoc(chain, query);
          } catch (error) {
            throw new ToolRefusal(
              `No documentation for ${query}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        const entries = await pythonIndex(chain, libs ?? DEFAULT_LIBS).catch(
          (error: Error) => {
            throw new ToolRefusal(
              `Python search is unavailable: ${error.message}`,
            );
          },
        );
        const hits = searchPython(entries, query).filter(
          (h) => !kind || h.kind === kind,
        );

        if (hits.length === 0) {
          return `No Python names match "${query}" (${entries.length} indexed). Try fewer or synonymous words.`;
        }
        const next = offset + limit;

        return [
          `${hits.length} matches for "${query}"${hits.length > limit ? `; showing ${offset + 1}-${Math.min(hits.length, next)}` : ""}:`,
          ...hits
            .slice(offset, next)
            .map(
              (e) =>
                `- ${e.kind} ${e.name}${e.signature}\n  ${e.doc ? e.doc.slice(0, 200) : "(no docstring)"}`,
            ),
          ...(next < hits.length
            ? [`More results: call again with offset ${next}.`]
            : []),
        ].join("\n");
      }),
  );
};
