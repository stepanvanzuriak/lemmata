import { z } from "zod";
import { updateCard } from "../../cards/apply.js";
import { fieldsOf, ToolRefusal } from "../../cards/types.js";
import { cardRef, guard, type RegisterTool } from "./shared.js";

const EDITABLE = [
  "title",
  "text",
  "markdown",
  "source",
  "python",
  "lean",
] as const;

function countOccurrences(haystack: string, needle: string) {
  let count = 0;
  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    count++;
  }
  return count;
}

export const registerEditCard: RegisterTool = (server, { db, run, find }) => {
  server.registerTool(
    "edit_card",
    {
      description:
        "Replace an exact string in one text field of a card, without resending the whole field. Use it for small fixes to long markdown or code; use update_card to rewrite a field or change status. old_string must match exactly (whitespace included) and, unless replace_all is set, occur exactly once — add surrounding context to make it unique. Editing source clears the last run.",
      inputSchema: {
        id: cardRef,
        field: z
          .enum(EDITABLE)
          .describe(
            "markdown for the body, source for python/lean card code, python/lean for toolbox snippets",
          ),
        old_string: z.string().min(1),
        new_string: z.string(),
        replace_all: z
          .boolean()
          .default(false)
          .describe("Replace every occurrence instead of requiring one"),
      },
    },
    ({ id, field, old_string, new_string, replace_all }) =>
      guard(async () => {
        if (old_string === new_string) {
          throw new ToolRefusal("old_string and new_string are the same.");
        }
        const { card } = await find(id);
        const current = fieldsOf(card)[field];

        if (typeof current !== "string" || current.length === 0) {
          throw new ToolRefusal(
            `[${card.id}] has no ${field}. Use update_card to set it.`,
          );
        }
        const count = countOccurrences(current, old_string);

        if (count === 0) {
          throw new ToolRefusal(
            `old_string not found in ${field} of [${card.id}]. Call get_card to see the exact current text.`,
          );
        }
        if (count > 1 && !replace_all) {
          throw new ToolRefusal(
            `old_string occurs ${count} times in ${field} of [${card.id}]. Add surrounding context to make it unique, or pass replace_all: true.`,
          );
        }
        const next = replace_all
          ? current.split(old_string).join(new_string)
          : current.replace(old_string, () => new_string);
        const updated = await updateCard(db, run, card.id, { [field]: next });

        return `Edited ${field} of [${updated.id}] "${fieldsOf(updated).title}": replaced ${count} occurrence${count > 1 ? "s" : ""}.`;
      }),
  );
};
