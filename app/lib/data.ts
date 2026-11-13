// Data access in the browser. Everything is fetched lazily from /data/<version>/* (dataVersion.ts)
// in small chunks:
//   i/manifest.json + i/<n>.json   search index (headword -> which dictionaries have it)
//   d/<id>/<shard>.json            one data set's entries for a hash range of headwords
//
// Speed: a chunk's file name depends only on the word, so a lookup requests the index and every
// selected dictionary chunk at the same time (one round trip, not three). On a first visit the
// inline PRELOAD_SCRIPT starts those same requests before the app's JavaScript has even loaded,
// and readJson reuses them.
import { DATA_VERSION, dataUrl, VERSION_URL } from "./dataVersion.ts";
import { type ChunkId, DICT, type DictId, entryKey, foldKey, rankScore, SHARDS, shardOf } from "./keys.ts";
import type { DictData, Entry, IndexRow } from "./types.ts";

declare global {
  interface Window {
    /** responses the inline preload script already requested, keyed by data path */
    __odPreload?: Record<string, Promise<Response>>;
  }
}

/**
 * Where a reload into a newer deploy should land. A client-side navigation loads data before the
 * address bar changes, so the word page's loader records the URL it is loading (setLoadingUrl).
 */
let loadingUrl: string | undefined;
export function setLoadingUrl(url: string) {
  loadingUrl = url;
}

async function readJson<T>(rel: string): Promise<T | null> {
  if (import.meta.env?.SSR) {
    // build-time prerender (home page stats): read the generated files directly
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    try {
      return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "site", rel), "utf8"));
    } catch {
      return null;
    }
  }
  const preloaded = window.__odPreload?.[rel];
  if (preloaded) delete window.__odPreload![rel];
  const res = await (preloaded ?? fetch(dataUrl(rel))).catch(() => null);
  // a missing file may come back as the SPA fallback page, so check the type too
  if (!res?.ok || !res.headers.get("content-type")?.includes("json")) {
    if (res) await reloadIfOutdated();
    return null;
  }
  return res.json();
}

/**
 * A tab opened before a deploy asks for files of a data version that is no longer deployed. When a
 * data file is missing, check which version is live and reload into it (the URL holds all state).
 * Never resolves while the page reloads, so the old tab doesn't flash "not found" first.
 *
 * At most one automatic reload per live version: the tab remembers (sessionStorage, this tab only)
 * which version it already reloaded for, so a mismatch a reload can't fix (e.g. a stale HTML cache)
 * never turns into a loop; the page then just shows "not found" as before.
 */
const RELOADED_FOR = "od.reloadedFor";
let versionCheck: Promise<void> | undefined;
function reloadIfOutdated(): Promise<void> {
  versionCheck ??= fetch(VERSION_URL, { cache: "no-cache" })
    .then((r) => (r.ok ? r.text() : null))
    .then((text) => {
      const live = text?.trim();
      if (!live || live === DATA_VERSION || sessionStorage.getItem(RELOADED_FOR) === live) return;
      sessionStorage.setItem(RELOADED_FOR, live);
      if (loadingUrl && loadingUrl !== location.href) location.assign(loadingUrl);
      else location.reload();
      return new Promise<void>(() => {});
    })
    .catch(() => {});
  return versionCheck;
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

const partPath = (id: ChunkId, key: string) => `d/${id}/${shardOf(key, SHARDS[id])}.json`;

/** A headword's data, or a pointer to its own file when it was too large for a shared chunk. */
type Stored<T> = T | { $file: string };

async function getPart<D extends ChunkId>(id: D, key: string): Promise<DictData[D] | undefined> {
  const shard = await cached<Record<string, Stored<DictData[D]>>>(partPath(id, key));
  const v = shard?.[key];
  if (v && typeof v === "object" && "$file" in v) return (await cached<DictData[D]>(`d/${id}/x/${v.$file}.json`)) ?? undefined;
  return v as DictData[D] | undefined;
}

/** Index row whose key equals the word, if the headword exists. */
async function lookup(word: string): Promise<IndexRow | null> {
  const key = entryKey(word);
  const q = foldKey(word);
  const manifest = await cached<Manifest>("i/manifest.json");
  if (!q || !manifest) return null;
  // rows with the same fold key (e.g. "cafe", "café") are adjacent; they may cross a chunk boundary
  for (let c = chunkFor(manifest.first, q); c < manifest.first.length && manifest.first[c] <= q; c++) {
    const chunk = await cached<Chunk>(`i/${c}.json`);
    const hit = chunk?.rows.find((r) => entryKey(r[0]) === key);
    if (hit) return hit;
  }
  return null;
}

export interface LoadedEntry {
  entry: Entry;
  /** Dictionaries that contain this headword (whether or not they were loaded). */
  mask: number;
}

/** Sentence pairs are bilingual, so they are shown with either translation dictionary. */
const wantsPairs = (dicts: DictId[]) => dicts.includes("enko") || dicts.includes("ko");

/** Data paths a lookup will need: index + chunks for the selected dictionaries. */
export function lookupPaths(word: string, dicts: DictId[]): string[] {
  const key = entryKey(word);
  const ids: ChunkId[] = [...dicts, ...(wantsPairs(dicts) ? (["ex"] as const) : [])];
  return ["i/manifest.json", ...ids.map((id) => partPath(id, key))];
}

/**
 * Loads a headword. The index lookup (display form, which dictionaries have it, frequency) and
 * the chunk of every selected dictionary are fetched in parallel; chunks of dictionaries that turn
 * out not to contain the word are simply ignored. Fetched chunks are cached.
 */
export async function getEntry(word: string, dicts: DictId[]): Promise<LoadedEntry | null> {
  const key = entryKey(word);
  const parts = {
    wn: dicts.includes("wn") ? getPart("wn", key) : undefined,
    en: dicts.includes("en") ? getPart("en", key) : undefined,
    enko: dicts.includes("enko") ? getPart("enko", key) : undefined,
    ko: dicts.includes("ko") ? getPart("ko", key) : undefined,
    ex: wantsPairs(dicts) ? getPart("ex", key) : undefined,
  };
  const row = await lookup(word);
  if (!row) return null;
  const [w, mask] = row;
  const entry: Entry = { w };
  const [wn, en, enko, ko, ex] = await Promise.all([parts.wn, parts.en, parts.enko, parts.ko, parts.ex]);
  if (wn && mask & DICT.wn) entry.wn = wn;
  if (en && mask & DICT.en) entry.en = en;
  if (enko && mask & DICT.enko) entry.enko = enko;
  if (ko && mask & DICT.ko) {
    if (ko.entries) entry.ko = ko.entries;
    if (ko.backlinks) entry.koBacklinks = ko.backlinks;
  }
  if (ex) entry.pairs = ex;
  return { entry, mask };
}

interface Manifest {
  chunk: number;
  first: string[];
}
interface Chunk {
  rows: IndexRow[];
  tops: Record<string, IndexRow[]>;
}

/**
 * Index of the last chunk whose first key is < q: the chunk where rows >= q can begin.
 * (Strict, because rows equal to q may also sit at the end of the previous chunk.)
 */
function chunkFor(first: string[], q: string) {
  let lo = 0;
  let hi = first.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (first[mid] < q) lo = mid;
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
