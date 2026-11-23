import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { strToU8, Zip, ZipDeflate } from "fflate";
import type { Db } from "core";
import { projectExportFileName } from "shared";
import { figuresDir } from "./runCard.js";

export const EXPORT_FORMAT = "lemmata-project";
export const EXPORT_VERSION = 2;

const FIGURE_NAME = /^fig-\d+(-views)?\.png$/;
const EVENT_PAGE = 500;

type Entry = {
  name: string;
  /**
   * Already-compressed files (PNGs) skip compression. Still a deflate entry,
   * not a stored one: a streaming unzip can't find the end of a stored entry
   * whose size it doesn't know yet.
   */
  store?: boolean;
  chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
};

const json = (value: unknown) => strToU8(`${JSON.stringify(value, null, 2)}\n`);

const file = (name: string, value: unknown): Entry => ({
  name,
  chunks: [json(value)],
});

/** Streams a JSON array one element at a time, so large lists never sit in one string. */
async function* jsonArray<T>(items: AsyncIterable<T>) {
  let first = true;

  for await (const item of items) {
    yield strToU8(`${first ? "[\n" : ",\n"}${JSON.stringify(item)}`);
    first = false;
  }

  yield strToU8(first ? "[]\n" : "\n]\n");
}

async function* canvases(db: Db, projectId: string) {
  const rows = await db.query.canvas.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  for (const canvas of rows) {
    const where = { canvasId: canvas.id };
    const [nodes, edges, agents, messages] = await Promise.all([
      db.query.canvasNode.findMany({ where }),
      db.query.canvasEdge.findMany({ where }),
      db.query.canvasAgent.findMany({ where }),
      db.query.chatMessage.findMany({ where, orderBy: { createdAt: "asc" } }),
    ]);

    yield { ...canvas, nodes, edges, agents, messages };
  }
}

/**
 * One attempt's transcript as JSON lines, read a page at a time: transcripts
 * are by far the bulk of a project and can run to hundreds of megabytes.
 * `data` is stored as JSON text already, so it is spliced in unparsed.
 */
async function* transcript(db: Db, attemptId: string) {
  let after = 0;

  for (;;) {
    const rows = await db.query.attemptEvent.findMany({
      where: { attemptId, id: { gt: after } },
      orderBy: { id: "asc" },
      limit: EVENT_PAGE,
    });

    if (!rows.length) {
      return;
    }

    yield strToU8(
      rows
        .map(
          ({ id, kind, createdAt, data }) =>
            `{"id":${id},"kind":${JSON.stringify(kind)},"createdAt":${JSON.stringify(createdAt)},"data":${data}}\n`,
        )
        .join(""),
    );
    after = rows.at(-1)!.id;
  }
}

async function* figures(workspaceDir: string, nodeIds: string[]) {
  for (const nodeId of nodeIds) {
    const dir = figuresDir(workspaceDir, nodeId);
    const names = await readdir(dir).catch(() => [] as string[]);

    for (const name of names.sort()) {
      if (name !== "figures.json" && !FIGURE_NAME.test(name)) {
        continue;
      }

      const bytes = await readFile(join(dir, name)).catch(() => null);

      if (bytes) {
        yield {
          name: `figures/${nodeId}/${name}`,
          store: name.endsWith(".png"),
          chunks: [new Uint8Array(bytes)],
        } satisfies Entry;
      }
    }
  }
}

async function* entries(
  db: Db,
  project: { id: string },
  workspaceDir: string,
): AsyncGenerator<Entry> {
  yield file("manifest.json", {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
  });
  yield file("project.json", project);

  const nodeIds: string[] = [];

  yield {
    name: "canvases.json",
    chunks: jsonArray(
      (async function* () {
        for await (const canvas of canvases(db, project.id)) {
          nodeIds.push(...canvas.nodes.map((node) => node.id));
          yield canvas;
        }
      })(),
    ),
  };

  const attempts = await db.query.attempt.findMany({
    where: { projectId: project.id },
    orderBy: { startedAt: "asc" },
  });

  yield file("attempts.json", attempts);

  for (const attempt of attempts) {
    yield {
      name: `transcripts/${attempt.id}.jsonl`,
      chunks: transcript(db, attempt.id),
    };
  }

  yield file(
    "memory.json",
    await db.query.memoryEntry.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    }),
  );

  yield* figures(workspaceDir, nodeIds);
}

/** Feeds entries into a streaming zip, one chunk per pull, so a slow reader holds back the database reads. */
function zipStream(source: AsyncIterable<Entry>): ReadableStream<Uint8Array> {
  let zip!: Zip;
  let produced = 0;

  async function* pump() {
    for await (const entry of source) {
      const out = new ZipDeflate(entry.name, { level: entry.store ? 0 : 6 });

      zip.add(out);

      for await (const chunk of entry.chunks) {
        out.push(chunk);
        yield;
      }

      out.push(new Uint8Array(0), true);
    }

    zip.end();
  }

  const steps = pump();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((error, chunk, final) => {
        if (error) {
          controller.error(error);
          return;
        }

        produced += 1;
        controller.enqueue(chunk);

        if (final) {
          controller.close();
        }
      });
    },
    // The stream won't pull again after a pull that enqueued nothing, and the
    // deflater often buffers a chunk, so pump until output appears.
    async pull(controller) {
      try {
        const before = produced;

        while (produced === before) {
          if ((await steps.next()).done) {
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await steps.return(undefined);
    },
  });
}

/**
 * Packs a project into a zip stream: its rows (canvases with their cards,
 * links, agents and chat; attempts; memory) as JSON, each attempt's
 * transcript as JSON lines, and each card's figures. Returns null when the
 * project doesn't exist.
 */
export async function exportProject(
  db: Db,
  projectId: string,
  workspaceDir: string,
) {
  const project = await db.query.project.findFirst({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  return {
    fileName: projectExportFileName(project.title),
    stream: zipStream(entries(db, project, workspaceDir)),
  };
}
