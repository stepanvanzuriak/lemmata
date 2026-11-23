import { mkdir, readdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { strFromU8, Unzip, UnzipInflate } from "fflate";
import { z } from "zod";
import {
  deleteProject,
  isoNow,
  schema,
  ulid,
  type Db,
  type Project,
} from "core";
import {
  attemptSchema,
  canvasAgentSchema,
  canvasSchema,
  chatMessageSchema,
  edgeSchema,
  memoryEntrySchema,
  nodeSchema,
  projectSchema,
} from "core/schema";
import { EXPORT_FORMAT, EXPORT_VERSION } from "./export.js";
import { figuresDir } from "./runCard.js";

export class ImportError extends Error {}

const FIGURE_NAME = /^fig-\d+(-views)?\.png$|^figures\.json$/;
const BATCH = 200;
/**
 * An id-shaped token standing alone. Ids are ULIDs, but not all of them
 * (hand-made fixtures exist), so the match is loose; only tokens that are
 * ids of this import get replaced.
 */
const ID_TOKEN = /(?<![0-9A-Za-z])[0-9A-Z]{20,40}(?![0-9A-Za-z])/g;

const manifestSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number(),
});

const canvasesSchema = z.array(
  canvasSchema.extend({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    agents: z.array(canvasAgentSchema),
    messages: z.array(
      chatMessageSchema.extend({ cards: z.array(z.string()).nullable() }),
    ),
  }),
);

const eventSchema = z.object({
  kind: z.string(),
  createdAt: z.string(),
  data: z.unknown(),
});

type Entry = { name: string; data: Uint8Array };

/** Unzips a byte stream entry by entry; each entry is held in memory only until it's handled. */
async function* unzip(body: AsyncIterable<Uint8Array>): AsyncGenerator<Entry> {
  const ready: Entry[] = [];
  let failure: unknown = null;
  const unzipper = new Unzip((file) => {
    const chunks: Uint8Array[] = [];

    file.ondata = (error, chunk, final) => {
      if (error) {
        failure = error;
        return;
      }

      chunks.push(chunk);

      if (final) {
        ready.push({ name: file.name, data: concat(chunks) });
      }
    };
    file.start();
  });

  unzipper.register(UnzipInflate);

  const push = (chunk: Uint8Array, final: boolean) => {
    try {
      unzipper.push(chunk, final);
    } catch (error) {
      failure = error;
    }

    if (failure) {
      throw new ImportError(`not a valid .lemmata archive: ${String(failure)}`);
    }
  };

  for await (const chunk of body) {
    push(chunk, false);
    yield* ready.splice(0);
  }

  push(new Uint8Array(0), true);
  yield* ready.splice(0);
}

function concat(chunks: Uint8Array[]) {
  if (chunks.length === 1) {
    return chunks[0]!;
  }

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;

  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }

  return out;
}

function parse<T>(name: string, text: string, schema: z.ZodType<T>): T {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw new ImportError(`${name} is not valid JSON`);
  }

  const result = schema.safeParse(value);

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ImportError(
      `${name}: ${issue?.path.join(".") || "value"}: ${issue?.message}`,
    );
  }

  return result.data;
}

async function* batches<T>(rows: T[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    yield rows.slice(i, i + BATCH);
  }
}

/** Drops claims and run markers: whoever held them isn't running here. */
function releasePayload(payload: string) {
  try {
    const value = JSON.parse(payload) as Record<string, unknown>;

    if (value.claimedBy != null && value.status === "claimed") {
      value.status = "open";
    }

    delete value.claimedBy;
    delete value.claimedByRole;
    delete value.runningSince;
    return JSON.stringify(value);
  } catch {
    return payload;
  }
}

/** A folder for the project: created here, or an existing empty one. */
async function claimFolder(dir: string) {
  const info = await stat(dir).catch(() => null);

  if (!info) {
    await mkdir(dir, { recursive: true }).catch(() => {
      throw new ImportError(`cannot create folder: ${dir}`);
    });
    return true;
  }

  if (!info.isDirectory()) {
    throw new ImportError(`not a folder: ${dir}`);
  }

  if ((await readdir(dir)).length) {
    throw new ImportError(`folder is not empty: ${dir}`);
  }

  return false;
}

/**
 * Creates a project from a `.lemmata` archive (see export.ts) in `dir`.
 * Every id gets a fresh one, so a project can be imported next to the copy
 * it was exported from; ids mentioned inside payloads, chat and transcripts
 * are rewritten to match. On any failure the partial project is removed.
 */
export async function importProject(
  db: Db,
  body: AsyncIterable<Uint8Array>,
  { dir, workspaceDir }: { dir: string; workspaceDir: string },
): Promise<Project> {
  const createdFolder = await claimFolder(dir);
  const ids = new Map<string, string>();
  /** Rewrites ids mentioned in free text (payloads, chat, transcripts). */
  const remap = (text: string) =>
    text.replace(ID_TOKEN, (id) => ids.get(id) ?? id);
  /** Key columns are mapped directly, never through text matching. */
  const newId = (old: string | null) =>
    old == null ? null : (ids.get(old) ?? null);
  const fresh = (id: string) => {
    const next = ulid();
    ids.set(id, next);
    return next;
  };
  /** Keeps a reference only when it points at a row of this import. */
  const within = (set: Set<string>, id: string | null) =>
    id != null && set.has(id) ? id : null;
  const figureDirs: string[] = [];
  /** Old node id to new: figure folders are named by the old one. */
  const nodeIds = new Map<string, string>();

  let project: Project | null = null;
  let manifestSeen = false;
  let canvases: z.infer<typeof canvasesSchema> | null = null;
  let attemptsDone = false;
  const canvasIds = new Set<string>();
  const attemptIds = new Set<string>();

  const requireProject = (name: string) => {
    if (!project) {
      throw new ImportError(`${name} appears before project.json`);
    }
    return project;
  };

  try {
    for await (const { name, data } of unzip(body)) {
      if (name === "manifest.json") {
        const manifest = parse(name, strFromU8(data), manifestSchema);

        if (manifest.version !== EXPORT_VERSION) {
          throw new ImportError(
            `unsupported .lemmata version ${manifest.version} (expected ${EXPORT_VERSION})`,
          );
        }

        manifestSeen = true;
        continue;
      }

      if (!manifestSeen) {
        throw new ImportError("not a .lemmata archive: manifest.json missing");
      }

      if (name === "project.json") {
        const row = parse(name, strFromU8(data), projectSchema);
        const [inserted] = await db
          .insert(schema.project)
          .values({
            id: fresh(row.id),
            title: row.title,
            statement: row.statement,
            dir,
            createdAt: row.createdAt,
            updatedAt: isoNow(),
          })
          .returning();

        project = inserted!;
        continue;
      }

      if (name === "canvases.json") {
        requireProject(name);
        canvases = parse(name, strFromU8(data), canvasesSchema);

        for (const canvas of canvases) {
          canvasIds.add(fresh(canvas.id));

          for (const rows of [
            canvas.nodes,
            canvas.edges,
            canvas.agents,
            canvas.messages,
          ]) {
            rows.forEach((row) => fresh(row.id));
          }

          canvas.nodes.forEach((node) =>
            nodeIds.set(node.id, ids.get(node.id)!),
          );
        }
        continue;
      }

      if (name === "attempts.json") {
        const { id: projectId } = requireProject(name);

        if (!canvases) {
          throw new ImportError("attempts.json appears before canvases.json");
        }

        const raw = parse(name, strFromU8(data), z.array(attemptSchema));

        raw.forEach((row) => attemptIds.add(fresh(row.id)));
        // Every id is known now, so references can be rewritten.
        canvases = canvases.map((old) => {
          const canvas = parse(
            "canvases.json",
            remap(JSON.stringify([old])),
            canvasesSchema,
          )[0]!;

          return {
            ...canvas,
            id: newId(old.id)!,
            parentCanvasId: newId(old.parentCanvasId),
            nodes: canvas.nodes.map((node, i) => ({
              ...node,
              id: newId(old.nodes[i]!.id)!,
            })),
            edges: canvas.edges
              .map((edge, i) => ({
                ...edge,
                id: newId(old.edges[i]!.id)!,
                fromNode: newId(old.edges[i]!.fromNode)!,
                toNode: newId(old.edges[i]!.toNode)!,
              }))
              .filter((edge) => edge.fromNode && edge.toNode),
            agents: canvas.agents.map((agent, i) => ({
              ...agent,
              id: newId(old.agents[i]!.id)!,
            })),
            messages: canvas.messages.map((message, i) => ({
              ...message,
              id: newId(old.messages[i]!.id)!,
              attemptId: newId(old.messages[i]!.attemptId),
              agentId: newId(old.messages[i]!.agentId),
            })),
          };
        });
        const attempts = raw.map((old) => ({
          ...parse(name, remap(JSON.stringify(old)), attemptSchema),
          id: newId(old.id)!,
          canvasId: newId(old.canvasId),
        }));

        await insertCanvases(db, projectId, canvases, canvasIds);

        for await (const rows of batches(attempts)) {
          await db.insert(schema.attempt).values(
            rows.map((row) => ({
              ...row,
              projectId,
              canvasId: within(canvasIds, row.canvasId),
              status: row.status === "running" ? "aborted" : row.status,
              finishedAt:
                row.finishedAt ?? (row.status === "running" ? isoNow() : null),
            })),
          );
        }

        const messages = canvases.flatMap((canvas) =>
          canvas.messages.map((message) => ({
            ...message,
            canvasId: canvas.id,
            attemptId: within(attemptIds, message.attemptId),
          })),
        );
        const agentIds = new Set(
          canvases.flatMap((canvas) => canvas.agents.map((agent) => agent.id)),
        );

        for await (const rows of batches(messages)) {
          await db.insert(schema.chatMessage).values(
            rows.map((row) => ({
              ...row,
              agentId: within(agentIds, row.agentId),
            })),
          );
        }

        attemptsDone = true;
        continue;
      }

      const transcript = /^transcripts\/([^/]+)\.jsonl$/.exec(name);

      if (transcript) {
        if (!attemptsDone) {
          throw new ImportError(`${name} appears before attempts.json`);
        }

        const attemptId = within(attemptIds, newId(transcript[1]!));

        if (!attemptId) {
          continue;
        }

        const lines = strFromU8(data).split("\n").filter(Boolean);

        for (let i = 0; i < lines.length; i += BATCH) {
          await db.insert(schema.attemptEvent).values(
            lines.slice(i, i + BATCH).map((line) => {
              const event = parse(name, remap(line), eventSchema);

              return {
                attemptId,
                kind: event.kind,
                createdAt: event.createdAt,
                data: JSON.stringify(event.data) ?? "null",
              };
            }),
          );
        }
        continue;
      }

      if (name === "memory.json") {
        const { id: projectId } = requireProject(name);
        const rows = parse(name, strFromU8(data), z.array(memoryEntrySchema));

        for await (const batch of batches(rows)) {
          await db.insert(schema.memoryEntry).values(
            batch.map((old) => ({
              ...parse(name, remap(JSON.stringify(old)), memoryEntrySchema),
              id: ulid(),
              projectId,
              canvasId: within(canvasIds, newId(old.canvasId)),
              attemptId: within(attemptIds, newId(old.attemptId)),
            })),
          );
        }
        continue;
      }

      const figure = /^figures\/([^/]+)\/([^/]+)$/.exec(name);

      if (figure && FIGURE_NAME.test(figure[2]!)) {
        const nodeId = nodeIds.get(figure[1]!);

        if (nodeId) {
          const target = figuresDir(workspaceDir, nodeId);

          await mkdir(target, { recursive: true });
          figureDirs.push(target);
          await writeFile(join(target, figure[2]!), data);
        }
      }
    }

    if (!project || !attemptsDone) {
      throw new ImportError(
        "incomplete .lemmata archive: project, canvases or attempts missing",
      );
    }

    return project;
  } catch (error) {
    if (project) {
      await deleteProject(db, project.id).catch(() => {});
    }

    await Promise.all(
      figureDirs.map((path) => rm(path, { recursive: true, force: true })),
    );

    if (createdFolder) {
      await rmdir(dir).catch(() => {});
    }

    throw error;
  }
}

/** Canvases go in parents first (a branch points at the canvas it came from), then their cards, links and agents. */
async function insertCanvases(
  db: Db,
  projectId: string,
  canvases: z.infer<typeof canvasesSchema>,
  canvasIds: Set<string>,
) {
  const inserted = new Set<string>();
  let pending = canvases;

  while (pending.length) {
    const next = pending.filter(
      (canvas) =>
        !canvasIds.has(canvas.parentCanvasId ?? "") ||
        inserted.has(canvas.parentCanvasId!) ||
        // A cycle can't come from the app; break it rather than loop.
        !pending.some((other) => other.id === canvas.parentCanvasId),
    );
    const batch = next.length ? next : pending.slice(0, 1);

    for (const canvas of batch) {
      const { nodes, edges, agents, messages: _messages, ...row } = canvas;

      await db.insert(schema.canvas).values({
        ...row,
        projectId,
        parentCanvasId: inserted.has(row.parentCanvasId ?? "")
          ? row.parentCanvasId
          : null,
      });

      for await (const rows of batches(nodes)) {
        await db.insert(schema.canvasNode).values(
          rows.map((node) => ({
            ...node,
            canvasId: canvas.id,
            payload: releasePayload(node.payload),
          })),
        );
      }

      for await (const rows of batches(edges)) {
        await db
          .insert(schema.canvasEdge)
          .values(rows.map((edge) => ({ ...edge, canvasId: canvas.id })));
      }

      for await (const rows of batches(agents)) {
        await db
          .insert(schema.canvasAgent)
          .values(rows.map((agent) => ({ ...agent, canvasId: canvas.id })));
      }

      inserted.add(canvas.id);
    }

    pending = pending.filter((canvas) => !inserted.has(canvas.id));
  }
}
