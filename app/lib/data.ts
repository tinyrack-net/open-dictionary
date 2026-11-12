// Data access shared by prerender (Node, reads data/site) and the browser (fetches /data/*).
import { entryKey, foldKey, rankScore, shardOf } from "./keys";
import type { Entry, IndexRow } from "./types";

async function readJson<T>(rel: string): Promise<T | null> {
  if (import.meta.env.SSR) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    try {
      return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "site", rel), "utf8"));
    } catch {
      return null;
    }
  }
  const res = await fetch(`/data/${rel}`);
  // a missing file may come back as the SPA fallback page, so check the type too
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
  return res.json();
}

const cache = new Map<string, Promise<any>>();
function cached<T>(rel: string): Promise<T | null> {
  let p = cache.get(rel);
  if (!p) {
    p = readJson<T>(rel);
    cache.set(rel, p);
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
  }
  return p;
}

export async function getEntry(word: string): Promise<Entry | null> {
  const key = entryKey(word);
  const shard = await cached<Record<string, Entry>>(`e/${shardOf(key)}.json`);
  return shard?.[key] ?? null;
}

interface Manifest {
  chunk: number;
  first: string[];
}
interface Chunk {
  rows: IndexRow[];
  tops: Record<string, IndexRow[]>;
}

/** Index of the last chunk whose first key is <= q. */
function chunkFor(first: string[], q: string) {
  let lo = 0;
  let hi = first.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (first[mid] <= q) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const byRank = (q: string) => (a: IndexRow, b: IndexRow) => {
  const ea = foldKey(a[0]) === q ? 0 : 1;
  const eb = foldKey(b[0]) === q ? 0 : 1;
  return ea - eb || rankScore(a) - rankScore(b) || (a[0] < b[0] ? -1 : 1);
};

/**
 * Prefix search. `mask` limits results to the selected dictionaries.
 * Rows are sorted by fold key, so all matches are contiguous: they fit in two chunks unless
 * the prefix is very common, in which case the precomputed top list is used.
 */
export async function search(query: string, limit = 10, mask = 0xff): Promise<IndexRow[]> {
  const q = foldKey(query);
  if (!q) return [];
  const manifest = await cached<Manifest>("i/manifest.json");
  if (!manifest) return [];
  const start = chunkFor(manifest.first, q);
  const first = await cached<Chunk>(`i/${start}.json`);
  if (!first) return [];

  // the prefix range may begin in this chunk or (if q sorts after its last row) the next one
  let pos = first.rows.findIndex((r) => foldKey(r[0]) >= q);
  let chunkNo = start;
  let chunk = first;
  if (pos === -1 && start + 1 < manifest.first.length) {
    chunkNo = start + 1;
    chunk = (await cached<Chunk>(`i/${chunkNo}.json`)) ?? { rows: [], tops: {} };
    pos = 0;
  }

  const top = chunk.tops[q];
  const hits: IndexRow[] = [];
  if (top) {
    // very common prefix: exact match (if any) + precomputed best rows
    const exact = chunk.rows.slice(pos).filter((r) => foldKey(r[0]) === q);
    hits.push(...exact, ...top.filter((t) => !exact.some((e) => e[0] === t[0])));
  } else {
    const collect = (rows: IndexRow[], from: number) => {
      for (let i = from; i < rows.length; i++) {
        if (!foldKey(rows[i][0]).startsWith(q)) return true;
        hits.push(rows[i]);
      }
      return false;
    };
    const done = collect(chunk.rows, Math.max(pos, 0));
    if (!done && chunkNo + 1 < manifest.first.length) {
      const next = await cached<Chunk>(`i/${chunkNo + 1}.json`);
      if (next) collect(next.rows, 0);
    }
  }
  return hits
    .filter((r) => r[1] & mask)
    .sort(byRank(q))
    .slice(0, limit);
}

export interface Meta {
  builtAt: string;
  stats: { headwords: number; wn: number; en: number; enko: number; ko: number };
}
export const getMeta = () => cached<Meta>("meta.json");
