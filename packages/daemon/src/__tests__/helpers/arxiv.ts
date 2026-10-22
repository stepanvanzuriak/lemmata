import type { ArxivClient } from "../../arxiv/arxiv.js";
import { parseAtom } from "../../arxiv/atom.js";

export const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/1208.0053v3</id>
    <published>2012-08-01T00:00:00Z</published>
    <title>On sets defining few ordinary lines</title>
    <summary>  Let P be a set of n points in the plane, not all on a line.
      We show that if n is large &amp; there are fewer than n/2 ordinary lines... </summary>
    <author><name>Ben Green</name></author>
    <author><name>Terence Tao</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/math/0601001v1</id>
    <published>2006-01-01T00:00:00Z</published>
    <title>Rich lines
      in grids</title>
    <summary>About &lt;k&gt;-rich lines.</summary>
    <author><name>J&#243;zsef Solymosi</name></author>
  </entry>
</feed>`;

export const feedArxiv: ArxivClient = {
  search: async () => parseAtom(FEED),
  byIds: async (ids) => parseAtom(FEED).filter((p) => ids.includes(p.id)),
  fetchSource: async () => ({
    file: { name: "main.tex", data: new Uint8Array() },
    files: ["main.tex"],
  }),
};
