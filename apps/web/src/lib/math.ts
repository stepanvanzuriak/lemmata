const displayBlock = (tex: string) => `\n$$\n${tex.trim()}\n$$\n`;

export function normalizeMath(text: string) {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => displayBlock(tex))
    .replace(/^[ \t]*\$\$([^\n]+?)\$\$[ \t]*$/gm, (_, tex: string) =>
      displayBlock(tex),
    )
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => `$${tex}$`);
}
