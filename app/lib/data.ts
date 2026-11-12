// Data access shared by prerender (Node, reads files) and the browser (fetches /data/*).
import { entryKey, foldKey, prefixFile, rankScore, shardOf } from "./keys";
import type { Entry, IndexRow } from "./types";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  const res = await fetch(`${base}/data/${rel}`);
  if (!res.ok) return null;
  return res.json();
}

const cache = new Map<string, Promise<any>>();
function cached<T>(rel: string): Promise<T | null> {
  let p = cache.get(rel);
  if (!p) {
    p = readJson<T>(rel);
    cache.set(rel, p);
    if (import.meta.env.SSR && cache.size > 512) cache.delete(cache.keys().next().value!);
  }
  return p;
}

export async function getEntry(word: string): Promise<Entry | null> {
  const key = entryKey(word);
  const shard = await cached<Record<string, Entry>>(`e/${shardOf(key)}.json`);
  return shard?.[key] ?? null;
}

let splitSet: Promise<Set<string>> | null = null;
function splits() {
  return (splitSet ??= cached<string[]>("i/_split.json").then((s) => new Set(s ?? [])));
}

/** Prefix search over the adaptive index. Returns rows ordered for display. */
export async function search(query: string, limit = 12): Promise<IndexRow[]> {
  const q = foldKey(query);
  if (!q) return [];
  const chars = Array.from(q);
  const split = await splits();
  // walk down to the deepest index file for this prefix
  let depth = 1;
  while (depth < chars.length && split.has(chars.slice(0, depth).join(""))) depth++;
  const file = chars.slice(0, depth).join("");
  const rows = (await cached<IndexRow[]>(`i/${prefixFile(file)}.json`)) ?? [];
  const hits = rows.filter((r) => foldKey(r[0]).startsWith(q));
  return hits
    .sort((a, b) => {
      const ea = foldKey(a[0]) === q ? 0 : 1;
      const eb = foldKey(b[0]) === q ? 0 : 1;
      return ea - eb || rankScore(a) - rankScore(b) || (a[0] < b[0] ? -1 : 1);
    })
    .slice(0, limit);
}

export interface Meta {
  builtAt: string;
  stats: { headwords: number; wn: number; en: number; enko: number; ko: number };
}
export const getMeta = () => cached<Meta>("meta.json");
