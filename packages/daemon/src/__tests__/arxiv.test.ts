import { expect, it, vi } from "vitest";
import { ArxivError, HttpArxivClient } from "../arxiv/arxiv.js";
import { arxivId, parseAtom } from "../arxiv/atom.js";
import { toSearchQuery } from "../arxiv/query.js";
import { FEED } from "./helpers/arxiv.js";

it("parses Atom entries", () => {
  const [first, second] = parseAtom(FEED);

  expect(first).toEqual({
    id: "1208.0053",
    title: "On sets defining few ordinary lines",
    authors: ["Ben Green", "Terence Tao"],
    published: "2012-08-01",
    abstract:
      "Let P be a set of n points in the plane, not all on a line. We show that if n is large & there are fewer than n/2 ordinary lines...",
    url: "https://arxiv.org/abs/1208.0053",
  });
  expect(second).toMatchObject({
    id: "math/0601001",
    title: "Rich lines in grids",
    authors: ["József Solymosi"],
    abstract: "About <k>-rich lines.",
  });
});

it("skips the error entry arXiv sends for a bad query", () => {
  const feed = `<feed><entry><id>http://arxiv.org/api/errors#x</id><title>Error</title><summary>bad</summary></entry></feed>`;
  expect(parseAtom(feed)).toEqual([]);
});

it("normalises ids and builds queries", () => {
  expect(arxivId("https://arxiv.org/pdf/2101.01234v2.pdf")).toBe("2101.01234");
  expect(arxivId("arXiv:2101.01234")).toBe("2101.01234");
  expect(toSearchQuery('rich lines "no k+1 collinear"')).toBe(
    'all:rich AND all:lines AND all:"no k+1 collinear"',
  );
  expect(
    toSearchQuery(
      "Solymosi Stojaković many collinear k-tuples with no k+1 collinear points, o(n^2)",
    ),
  ).toBe(
    "all:Solymosi AND all:Stojakovic AND all:many AND all:collinear AND all:k-tuples AND all:collinear AND all:points",
  );
  expect(toSearchQuery("Erdős orchard problem", "OR")).toBe(
    "all:Erdos OR all:orchard",
  );
  expect(toSearchQuery("ti:orchard AND cat:math.CO")).toBe(
    "ti:orchard AND cat:math.CO",
  );
});

it("spaces requests, caches answers and turns network failures into ArxivError", async () => {
  const fetchFn = vi.fn(async (_url: string) => new Response(FEED));
  const client = new HttpArxivClient(fetchFn as unknown as typeof fetch, 50);
  const started = Date.now();

  const [a, b] = await Promise.all([
    client.search("ordinary lines"),
    client.search("rich lines"),
  ]);
  await client.search("ordinary lines");

  expect(a).toHaveLength(2);
  expect(b).toHaveLength(2);
  expect(fetchFn).toHaveBeenCalledTimes(2);
  expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  expect(String(fetchFn.mock.calls[0]![0])).toContain(
    "search_query=all%3Aordinary+AND+all%3Alines",
  );

  const empty = vi.fn(
    async (url: string) =>
      new Response(url.includes("+OR+") ? FEED : "<feed></feed>"),
  );
  const loose = new HttpArxivClient(empty as unknown as typeof fetch, 0);
  expect(await loose.search("few ordinary lines plane")).toHaveLength(2);
  expect(await loose.search("ordinary lines")).toHaveLength(0);
  expect(empty).toHaveBeenCalledTimes(3);

  const offline = new HttpArxivClient(async () => {
    throw new Error("ENOTFOUND");
  }, 0);
  await expect(offline.search("lines")).rejects.toBeInstanceOf(ArxivError);
  await expect(offline.search("points")).rejects.toThrow(/unreachable/);
});

it("stops calling arXiv for a while after repeated 429s", async () => {
  const fetchFn = vi.fn(async () => new Response("", { status: 429 }));
  const client = new HttpArxivClient(
    fetchFn as unknown as typeof fetch,
    0,
    60_000,
  );

  await expect(client.byIds(["1208.0053"])).rejects.toThrow(/rate-limiting/);
  expect(fetchFn).toHaveBeenCalledTimes(2);

  await expect(client.search("ordinary lines")).rejects.toThrow(/Wait 1 min/);
  expect(fetchFn).toHaveBeenCalledTimes(2);
});
