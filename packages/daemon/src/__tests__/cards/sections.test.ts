import { expect, it } from "vitest";
import { replaceSection } from "../../cards/sections.js";

const card = `Intro.

## Argument
Step 1.

### Detail
Inner.

## Progress
old progress

## Notes
keep`;

it("replaces one section and keeps the rest", () => {
  expect(replaceSection(card, "progress", "**Established** x")).toBe(`Intro.

## Argument
Step 1.

### Detail
Inner.

## Progress

**Established** x

## Notes
keep`);
});

it("replaces a section with its subsections, up to the next same-level heading", () => {
  const out = replaceSection(card, "## Argument", "New argument.");
  expect(out).toContain("## Argument\n\nNew argument.\n\n## Progress");
  expect(out).not.toContain("Inner.");
});

it("appends a missing section", () => {
  expect(replaceSection("Body.", "Progress", "first")).toBe(
    "Body.\n\n## Progress\n\nfirst",
  );
  expect(replaceSection("", "Progress", "first")).toBe("## Progress\n\nfirst");
});
