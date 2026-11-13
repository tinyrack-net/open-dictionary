// Shared key / sharding helpers. Used by the data pipeline (scripts/build-data.ts),
// the prerender loader (server) and the browser (client). Keep them pure.

/** Lookup key for a headword: NFC + lowercase + trimmed. One page per key. */
export function entryKey(word: string): string {
  return word.normalize("NFC").trim().toLowerCase();
}

/** Search key: entry key with Latin diacritics removed (Hangul is recomposed by NFC). */
export function foldKey(word: string): string {
  return entryKey(word).normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/** FNV-1a 32-bit hash over UTF-16 code units. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Chunk file name for a key in a dictionary with `shards` chunks. */
export function shardOf(key: string, shards: number): string {
  return (fnv1a(key) % shards).toString(16).padStart(Math.max(1, (shards - 1).toString(16).length), "0");
}

/** File name for a headword stored in its own file (too large for a shared chunk). ASCII-safe. */
export function ownFileName(key: string): string {
  return fnv1a(key).toString(16).padStart(8, "0") + "-" + fnv1a(key + "\u0000").toString(16).padStart(8, "0");
}

/** Bit flags marking which dictionaries contain a headword. */
export const DICT = {
  wn: 1, // Open English WordNet (EN-EN)
  en: 2, // Wiktionary English (EN-EN)
  enko: 4, // Wiktionary translations (EN->KO)
  ko: 8, // Wiktionary Korean entries + reverse translations (KO->EN)
} as const;
export type DictId = keyof typeof DICT;

/** Chunked data sets: the four dictionaries plus bilingual example sentences ("ex"). */
export type ChunkId = DictId | "ex";

/**
 * Number of chunk files per data set (data/site/d/<id>/<shard>.json).
 * Sized so one chunk is ~200 KB raw / ~50 KB compressed with the complete (uncapped) data.
 */
export const SHARDS: Record<ChunkId, number> = { wn: 256, en: 4096, enko: 32, ko: 256, ex: 64 };

/** Ranking for prefix matches: lower is better (common, well-covered, short, plain words first). */
export function rankScore([w, m, f]: [string, number, number?]): number {
  let s = Array.from(w).length;
  // Zipf x10: "love" 58 -> -29, a rare word 25 -> -12
  if (f) s -= f / 2;
  if (m & DICT.wn) s -= 20;
  if (m & DICT.ko) s -= 15;
  if (m & DICT.enko) s -= 5;
  if (/[^\p{L}]/u.test(w)) s += 10;
  if (/\p{Lu}/u.test(w)) s += 3;
  return s;
}
