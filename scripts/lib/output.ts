// Writes the collected headwords (core.ts) as the static data the site serves:
//
//   d/<dictionary id>/<shard>.json   { [entryKey]: DictPart }, chunk count sized per dictionary
//   d/<dictionary id>/x/<hash>.json  a single headword too large for a shared chunk
//   d/<dictionary id>/s/<shard>.json sentence store of a sentence corpus: { [sentence id]: Sentence }
//   i/manifest.json                  index chunk boundaries + each dictionary's chunk counts
//   i/<n>.json                       search index chunks: headword, dictionary mask, frequency
//   meta.json                        build stats
//   version.txt                      content hash of d/ and i/ (the site serves data under /data/<version>/)
//
// Nothing here knows any dictionary: everything is driven by DICTIONARIES and the collected parts.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DICTIONARIES, dictMask, rankScore } from "../../app/lib/dicts.ts";
import { foldKey, ownFileName, sentenceShard, shardOf } from "../../app/lib/keys.ts";
import type { Backlink, DictEntry, DictPart, IndexRow, Sentence } from "../../app/lib/types.ts";
import { headwords, readSpool, readStore, ROOT, spoolSize } from "./core.ts";

export const OUT = path.join(ROOT, "data", "site");

/**
 * Every data file goes through here and into the content hash. Files are written in a deterministic
 * order, so the same input gives the same version and browsers keep their cache across identical builds.
 */
const contentHash = crypto.createHash("sha256");
function writeData(file: string, json: string) {
  contentHash.update(path.relative(OUT, file).replaceAll(path.sep, "/")).update("\n").update(json).update("\n");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json);
}

function rmrf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Headwords whose data is larger than this are written to their own file (d/<id>/x/<hash>.json) and
 * the chunk keeps a pointer { "$file": "<hash>" }. Nothing is cut; this only keeps one huge headword
 * (Korean 사: 174 hanja senses, 880 KB) from slowing down every other lookup in its chunk.
 */
const OWN_FILE_BYTES = 64_000;
/** Target chunk size: ~200 KB raw / ~50 KB compressed. The chunk count is a power of two. */
const CHUNK_BYTES = 200_000;

const chunkCount = (bytes: number) => 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(1, bytes / CHUNK_BYTES))));

/**
 * Writes one dictionary's chunks from its spool file. Its headwords' parts are assembled in memory a
 * group of chunks at a time (GROUPS passes over the spool), so even the largest dictionary never sits
 * in memory whole. Parts keep the order their fragments were added in, which is the sources' order.
 */
async function writeDictionary(id: string, n: number) {
  const dir = path.join(OUT, "d", id);
  rmrf(dir);
  // ~300 MB of parts per pass at most
  const groups = Math.max(1, Math.min(n, Math.ceil(spoolSize(id) / 300e6)));
  const groupOf = (shard: number) => shard % groups;
  let ownFiles = 0;
  let bytes = 0;
  let max = 0;
  let gz = 0;
  let chunks = 0;
  for (let g = 0; g < groups; g++) {
    const parts = new Map<string, DictPart>();
    for await (const [key, kind, value] of readSpool(id)) {
      const shard = parseInt(shardOf(key, n), 16);
      if (groupOf(shard) !== g) continue;
      let part = parts.get(key);
      if (!part) parts.set(key, (part = {}));
      if (kind === "e") (part.entries ??= []).push(value as DictEntry);
      else if (kind === "b") (part.backlinks ??= []).push(value as Backlink);
      else (part.sentences ??= []).push(value as number);
    }
    const byChunk = new Map<string, string[]>();
    for (const key of [...parts.keys()].sort()) {
      let json = JSON.stringify(parts.get(key));
      parts.delete(key);
      if (json.length > OWN_FILE_BYTES) {
        const file = ownFileName(key);
        writeData(path.join(dir, "x", `${file}.json`), json);
        json = JSON.stringify({ $file: file });
        ownFiles++;
      }
      const s = shardOf(key, n);
      let c = byChunk.get(s);
      if (!c) byChunk.set(s, (c = []));
      c.push(`${JSON.stringify(key)}:${json}`);
    }
    for (const s of [...byChunk.keys()].sort()) {
      const json = `{${byChunk.get(s)!.join(",")}}`;
      bytes += json.length;
      max = Math.max(max, json.length);
      if (chunks++ % 16 === 0) gz += zlib.gzipSync(json).length * 16; // sampled compressed size
      writeData(path.join(dir, `${s}.json`), json);
    }
  }
  return { chunks, ownFiles, mb: +(bytes / 1e6).toFixed(0), avgKb: +(bytes / chunks / 1e3).toFixed(0), maxKb: +(max / 1e3).toFixed(0), avgGzKb: +(gz / chunks / 1e3).toFixed(0) };
}

/**
 * Chunk count for a dictionary from its spooled size: ~CHUNK_BYTES per chunk, a power of two. The
 * spool is a little larger than the written data (keys and markers per fragment), which errs on the
 * side of smaller chunks.
 */
function chunksFor(id: string): number {
  const size = spoolSize(id);
  return size ? chunkCount(size * 0.85) : 0;
}

/**
 * Writes a dictionary's sentence store: every sentence once, by id, in d/<id>/s/<shard>.json. A
 * headword lists sentence ids; the browser fetches the store chunks of the ids it shows.
 */
async function writeStore(id: string): Promise<number> {
  const size = spoolSize(`${id}.store`);
  if (!size) return 0;
  const n = chunkCount(size);
  const byChunk = new Map<string, Record<number, Sentence>>();
  for await (const [sid, sentence] of readStore(id)) {
    const s = sentenceShard(sid, n);
    let c = byChunk.get(s);
    if (!c) byChunk.set(s, (c = {}));
    c[sid] = sentence;
  }
  for (const s of [...byChunk.keys()].sort()) writeData(path.join(OUT, "d", id, "s", `${s}.json`), JSON.stringify(byChunk.get(s)));
  return n;
}

/**
 * Search index: all headwords sorted by fold key and cut into fixed-size chunks.
 *
 *   i/manifest.json   { chunk, first, shards, stores }   first fold key of every chunk, chunk counts
 *   i/<n>.json        { rows: IndexRow[], tops: { [prefix]: IndexRow[] } }
 *
 * A prefix with at most CHUNK matches spans at most two chunks, so the client loads them and ranks
 * the matches itself. Larger prefixes get a precomputed top list stored in the chunk that holds
 * their first row. This keeps the index at a few hundred files (Workers free plan: 20k files).
 */
const CHUNK = 2500;
const TOP_N = 15;
const TOP_MAX_LEN = 16;

function writeIndex(shards: Record<string, number>, stores: Record<string, number>) {
  const dir = path.join(OUT, "i");
  rmrf(dir);
  const rows: { f: string; cp: string[]; row: IndexRow; s: number }[] = [];
  for (const h of headwords.values()) {
    const f = foldKey(h.w);
    const mask = dictMask(h.dicts);
    if (!f || !mask) continue;
    const row: IndexRow = h.freq ? [h.w, mask, Math.round(h.freq * 10)] : [h.w, mask];
    rows.push({ f, cp: Array.from(f), row, s: rankScore(row) });
  }
  rows.sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : a.row[0] < b.row[0] ? -1 : 1));

  const chunks = Math.ceil(rows.length / CHUNK);
  const tops: Record<string, IndexRow[]>[] = Array.from({ length: chunks }, () => ({}));
  let topCount = 0;
  for (let len = 1; len <= TOP_MAX_LEN; len++) {
    let start = 0;
    while (start < rows.length) {
      const prefix = rows[start].cp.length >= len ? rows[start].cp.slice(0, len).join("") : null;
      let end = start + 1;
      if (prefix !== null) while (end < rows.length && rows[end].f.startsWith(prefix)) end++;
      if (prefix !== null && end - start > CHUNK) {
        tops[Math.floor(start / CHUNK)][prefix] = rows.slice(start, end).sort((a, b) => a.s - b.s).slice(0, TOP_N).map((r) => r.row);
        topCount++;
      }
      start = end;
    }
  }

  const first: string[] = [];
  for (let c = 0; c < chunks; c++) {
    const slice = rows.slice(c * CHUNK, (c + 1) * CHUNK);
    first.push(slice[0].f);
    writeData(path.join(dir, `${c}.json`), JSON.stringify({ rows: slice.map((r) => r.row), tops: tops[c] }));
  }
  writeData(path.join(dir, "manifest.json"), JSON.stringify({ chunk: CHUNK, first, shards, stores }));
  console.log(`  index: ${rows.length} rows in ${chunks} chunks, ${topCount} precomputed prefixes`);
}

/** Writes everything from the spool files and the headword records; returns the data version. */
export async function writeSite(): Promise<string> {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(path.join(OUT, "d"), { recursive: true, force: true });
  const stats: Record<string, number> = { headwords: headwords.size };
  for (const d of DICTIONARIES) stats[d.id] = 0;
  for (const h of headwords.values()) for (const id of h.dicts) stats[id]++;
  const shards: Record<string, number> = {};
  const stores: Record<string, number> = {};
  const report: Record<string, unknown> = {};
  for (const d of DICTIONARIES) {
    const n = chunksFor(d.id);
    if (!n) {
      console.log(`  ${d.id}: no data (source missing?)`);
      continue;
    }
    shards[d.id] = n;
    report[d.id] = { headwords: stats[d.id], ...(await writeDictionary(d.id, n)) };
    const store = await writeStore(d.id);
    if (store) {
      stores[d.id] = store;
      (report[d.id] as Record<string, unknown>).sentenceChunks = store;
    }
    console.log(`  ${d.id}:`, JSON.stringify(report[d.id]));
  }
  writeIndex(shards, stores);
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ builtAt: new Date().toISOString(), stats, sizes: report }, null, 2));
  console.log("  stats", JSON.stringify(stats));
  const version = contentHash.digest("hex").slice(0, 12);
  fs.writeFileSync(path.join(OUT, "version.txt"), version);
  return version;
}
