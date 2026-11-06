const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces the body of the markdown section with this heading (any level, case
 * insensitive), up to the next heading of the same or a higher level. A missing
 * section is appended as a level-2 heading. Lets agents update one part of a long
 * card without rewriting, or even seeing, the rest of it.
 */
export function replaceSection(
  markdown: string,
  heading: string,
  content: string,
) {
  const title = heading.trim().replace(/^#+\s*/, "");
  const lines = markdown.split("\n");
  const pattern = new RegExp(`^(#{1,6})\\s+${escape(title)}\\s*#*\\s*$`, "i");
  const start = lines.findIndex((line) => pattern.test(line));
  const body = content.trim();

  if (start < 0) {
    return `${markdown.trimEnd()}${markdown.trim() ? "\n\n" : ""}## ${title}\n\n${body}`;
  }
  const level = lines[start]!.match(pattern)![1]!.length;
  let end = start + 1;

  while (end < lines.length) {
    const next = lines[end]!.match(/^(#{1,6})\s/);
    if (next && next[1]!.length <= level) {
      break;
    }
    end++;
  }
  const rest = lines.slice(end).join("\n");

  return [
    ...lines.slice(0, start + 1),
    "",
    body,
    ...(rest ? ["", rest] : []),
  ].join("\n");
}
