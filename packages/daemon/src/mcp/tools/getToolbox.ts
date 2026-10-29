import { z } from "zod";
import { indexToolbox } from "../../cards/toolboxIndex.js";
import { fieldsOf, isArchived, ToolRefusal } from "../../cards/types.js";
import { guard, type RegisterTool, type ToolContext } from "./shared.js";

const language = z.enum(["python", "lean"]);

async function toolbox(detail: ToolContext["detail"]) {
  const current = await detail();
  const card = current.nodes.find(
    (n) => n.kind === "toolbox" && !isArchived(n),
  );
  if (!card) {
    throw new ToolRefusal("This canvas has no toolbox yet.");
  }
  const fields = fieldsOf(card);
  const entries = [
    ...indexToolbox(fields.python ?? "", "python"),
    ...indexToolbox(fields.lean ?? "", "lean"),
  ];
  return { card, fields, entries };
}

export const registerGetToolbox: RegisterTool = (server, { detail }) => {
  server.registerTool(
    "get_toolbox_index",
    {
      description:
        "List named Python top-level functions/classes and Lean declarations in the canvas toolbox, without full source. Static outline; unusual syntax may need get_card. Includes namespaces, line ranges and first signature lines. Use get_toolbox_function for a definition, get_card for imports, shared variables and other context.",
      inputSchema: {
        language: language.optional(),
        query: z.string().trim().max(500).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true },
    },
    ({ language, query, limit, offset }) =>
      guard(async () => {
        const { card, entries } = await toolbox(detail);
        const wanted = query?.toLowerCase() ?? "";
        const matches = entries.filter(
          (e) =>
            (!language || e.language === language) &&
            `${e.name} ${e.signature}`.toLowerCase().includes(wanted),
        );
        return JSON.stringify({
          toolboxId: card.id,
          total: matches.length,
          entries: matches.slice(offset, offset + limit),
          nextOffset: offset + limit < matches.length ? offset + limit : null,
        });
      }),
  );

  server.registerTool(
    "get_toolbox_function",
    {
      description:
        "Read one toolbox function, class, theorem or other named declaration by exact indexed name. Returns its source and enclosing namespace/section context, without executing code. Dependencies and shared assumptions may require get_card on the toolboxId. Specify language when a name is ambiguous.",
      inputSchema: {
        name: z.string().trim().min(1).max(500),
        language: language.optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ name, language }) =>
      guard(async () => {
        const { card, fields, entries } = await toolbox(detail);
        const matches = entries.filter(
          (e) => e.name === name && (!language || e.language === language),
        );
        if (!matches.length) {
          throw new ToolRefusal(
            `No toolbox declaration named "${name}". Use get_toolbox_index for exact names, or get_card on ${card.id} for unindexed source.`,
          );
        }
        if (matches.length > 1) {
          throw new ToolRefusal(
            `Ambiguous toolbox name "${name}" (${matches.map((e) => `${e.language} line ${e.startLine}`).join(", ")}). Specify language; for duplicates within one language use get_card on ${card.id}.`,
          );
        }
        const entry = matches[0]!;
        return JSON.stringify({
          toolboxId: card.id,
          ...entry,
          source: fields[entry.language]!.split("\n")
            .slice(entry.startLine - 1, entry.endLine)
            .join("\n"),
        });
      }),
  );
};
