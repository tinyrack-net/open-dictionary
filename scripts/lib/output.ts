// Writes the collected headwords (core.ts) as the static data the site serves:
//
//   d/<dictionary id>/<shard>.json   { [entryKey]: DictPart }, chunk count sized per dictionary
//   d/<dictionary id>/x/<hash>.json  a single headword too large for a shared chunk
//   i/manifest.json                  index chunk boundaries + each dictionary's chunk count
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
import { foldKey, ownFileName, shardOf } from "../../app/lib/keys.ts";
import type { DictPart, IndexRow } from "../../app/lib/types.ts";
import { headwords, ROOT } from "./core.ts";

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
 * Writes every dictionary's chunks; returns their chunk counts and a size report. Memory: the largest
 * dictionary serializes to ~700 MB, so nothing is held for a whole dictionary. A first pass only
 * measures (to size the chunk count), the second serializes one chunk at a time, and each written
 * part is dropped from memory.
 */
function writeDictionaries() {
  fs.rmSync(path.join(OUT, "d"), { recursive: true, force: true });
  const shards: Record<string, number> = {};
  const report: Record<string, unknown> = {};
  for (const d of DICTIONARIES) {
    let total = 0;
    let count = 0;
    for (const h of headwords.values()) {
      const part = h.parts[d.id];
      if (!part) continue;
      total += Math.min(JSON.stringify(part).length, OWN_FILE_BYTES);
      count++;
    }
    if (!count) {
      console.log(`  ${d.id}: no data (source missing?)`);
      continue;
    }
    const n = chunkCount(total);
    shards[d.id] = n;
    // keys per chunk, in headword order
    const byChunk = new Map<string, string[]>();
    for (const [key, h] of headwords) {
      if (!h.parts[d.id]) continue;
      const s = shardOf(key, n);
      let keys = byChunk.get(s);
      if (!keys) byChunk.set(s, (keys = []));
      keys.push(key);
    }
    const dir = path.join(OUT, "d", d.id);
    rmrf(dir);
    let ownFiles = 0;
    let bytes = 0;
    let max = 0;
    let gz = 0;
    let i = 0;
    for (const s of [...byChunk.keys()].sort()) {
      const items: string[] = [];
      for (const key of byChunk.get(s)!) {
        const h = headwords.get(key)!;
        let json = JSON.stringify(h.parts[d.id]);
        delete h.parts[d.id];
        if (json.length > OWN_FILE_BYTES) {
          const file = ownFileName(key);
          writeData(path.join(dir, "x", `${file}.json`), json);
          json = JSON.stringify({ $file: file });
          ownFiles++;
        }
        items.push(`${JSON.stringify(key)}:${json}`);
      }
      const json = `{${items.join(",")}}`;
      bytes += json.length;
      max = Math.max(max, json.length);
      if (i++ % 16 === 0) gz += zlib.gzipSync(json).length * 16; // sampled compressed size
      writeData(path.join(dir, `${s}.json`), json);
    }
    report[d.id] = { headwords: count, chunks: byChunk.size, ownFiles, mb: +(bytes / 1e6).toFixed(0), avgKb: +(bytes / byChunk.size / 1e3).toFixed(0), maxKb: +(max / 1e3).toFixed(0), avgGzKb: +(gz / byChunk.size / 1e3).toFixed(0) };
    console.log(`  ${d.id}:`, JSON.stringify(report[d.id]));
  }
  return { shards, report };
}

/**
 * Search index: all headwords sorted by fold key and cut into fixed-size chunks.
 *
 *   i/manifest.json   { chunk, first: string[], shards }   first fold key of every chunk
 *   i/<n>.json        { rows: IndexRow[], tops: { [prefix]: IndexRow[] } }
 *
 * A prefix with at most CHUNK matches spans at most two chunks, so the client loads them and ranks
 * the matches itself. Larger prefixes get a precomputed top list stored in the chunk that holds
 * their first row. This keeps the index at a few hundred files (Workers free plan: 20k files).
 */
const CHUNK = 2500;
const TOP_N = 15;
const TOP_MAX_LEN = 16;

function writeIndex(shards: Record<string, number>, masks: Map<string, number>) {
  const dir = path.join(OUT, "i");
  rmrf(dir);
  const rows: { f: string; cp: string[]; row: IndexRow; s: number }[] = [];
  for (const [key, h] of headwords) {
    const f = foldKey(h.w);
    const mask = masks.get(key) ?? 0;
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
  writeData(path.join(dir, "manifest.json"), JSON.stringify({ chunk: CHUNK, first, shards }));
  console.log(`  index: ${rows.length} rows in ${chunks} chunks, ${topCount} precomputed prefixes`);
}

/** Writes everything; returns the data version. */
export function writeSite(): string {
  fs.mkdirSync(OUT, { recursive: true });
  // which dictionaries have each headword, recorded before the writer drops the parts
  const masks = new Map<string, number>();
  const stats: Record<string, number> = { headwords: headwords.size };
  for (const d of DICTIONARIES) stats[d.id] = 0;
  for (const [key, h] of headwords) {
    const ids = Object.keys(h.parts);
    masks.set(key, dictMask(ids));
    for (const id of ids) stats[id]++;
  }
  const { shards, report } = writeDictionaries();
  writeIndex(shards, masks);
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ builtAt: new Date().toISOString(), stats, sizes: report }, null, 2));
  console.log("  stats", JSON.stringify(stats));
  const version = contentHash.digest("hex").slice(0, 12);
  fs.writeFileSync(path.join(OUT, "version.txt"), version);
  return version;
}
