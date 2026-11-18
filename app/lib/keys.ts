// Headword keys and chunk file names. Used by the data pipeline (scripts/build/), the browser and the
// inline preload script (which mirrors them in plain JavaScript). Keep them pure.

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

/** Chunk file name for a key in a dictionary with `shards` chunks (the build picks the count per dictionary). */
export function shardOf(key: string, shards: number): string {
  return (fnv1a(key) % shards).toString(16).padStart(Math.max(1, (shards - 1).toString(16).length), "0");
}

/** File name for a headword stored in its own file (too large for a shared chunk). ASCII-safe. */
export function ownFileName(key: string): string {
  return fnv1a(key).toString(16).padStart(8, "0") + "-" + fnv1a(key + "\u0000").toString(16).padStart(8, "0");
}

/** Sentence store chunk of a sentence id (d/<id>/s/<shard>.json). Ids are dense, so a modulo spreads them evenly. */
export function sentenceShard(sid: number, shards: number): string {
  return (sid % shards).toString(16).padStart(Math.max(1, (shards - 1).toString(16).length), "0");
}
