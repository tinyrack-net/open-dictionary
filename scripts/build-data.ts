// Converts raw sources into the static data files served by the site.
//
//   raw/oewn/*.json      Open English WordNet 2025 (JSON release)
//   raw/en.jsonl.gz      Wiktionary English entries (kaikki.org / wiktextract)
//   raw/ko.jsonl.gz      Wiktionary Korean entries  (kaikki.org / wiktextract)
//   raw/wordfreq.json    word frequency (wordfreq 3.1, Zipf scale)        optional, search ranking only
//   raw/tatoeba/*.tsv    English–Korean sentence pairs (Tatoeba)          optional
//
// Output:
//   data/site/d/<id>/<shard>.json    per-source chunks, { [entryKey]: DictData[id] }, SHARDS[id] files
//   data/site/i/manifest.json        first key of each search index chunk
//   data/site/i/<n>.json             search index chunks: headword, dictionary bitmask, frequency
//   data/site/meta.json              build stats
//   data/site/version.txt            content hash of d/ and i/; the site serves the data under
//                                    /data/<version>/ so a browser never mixes cached files of two builds
//
// Every converter turns its source into the neutral format of app/lib/types.ts and follows its rules:
// copy, don't compose; keep the source's order and tags; keep everything; omit empty fields.
//
// Run: node --max-old-space-size=8000 scripts/build-data.ts

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { type ChunkId, DICT, entryKey, foldKey, ownFileName, rankScore, SHARDS, shardOf } from "../app/lib/keys.ts";
import type {
  Audio,
  Backlink,
  DictData,
  DictEntry,
  Example,
  Form,
  FormTable,
  IndexRow,
  Pron,
  Relations,
  RelationKind,
  Sense,
  SentencePair,
  Translation,
  WordRef,
} from "../app/lib/types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "data", "site");
const LIMIT = Number(process.env.LIMIT ?? Infinity); // lines per Wiktionary file (dev)

/**
 * Writes a data file and adds it to the content hash. Files are written in a deterministic order,
 * so the same input gives the same version and browsers keep their cache across identical builds.
 */
const contentHash = crypto.createHash("sha256");
function writeData(file: string, json: string) {
  contentHash.update(path.relative(OUT, file).replaceAll(path.sep, "/")).update("\n").update(json).update("\n");
  fs.writeFileSync(file, json);
}

/** Everything collected for one headword key, per source. */
interface Collected {
  w: string;
  freq?: number;
  wn?: DictEntry[];
  en?: DictEntry[];
  enko?: DictEntry[];
  ko?: DictEntry[];
  koBacklinks?: Backlink[];
  pairs?: SentencePair[];
}

const entries = new Map<string, Collected>();
function entryFor(display: string): Collected {
  const key = entryKey(display);
  let e = entries.get(key);
  if (!e) {
    e = { w: display };
    entries.set(key, e);
  }
  return e;
}

/** Drops undefined values and empty arrays/objects so the stored JSON stays lean. */
function compact<T extends object>(o: T): T {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0))
      delete (o as Record<string, unknown>)[k];
  }
  return o;
}
const strs = (xs: unknown): string[] | undefined => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string" && x !== "") : undefined);

// ---------------------------------------------------------------- Open English WordNet
/**
 * WordNet entries are lemma × part of speech; each sense is a synset. Copied fields: definition,
 * examples, the synset's other members (synonyms) and its hypernyms' members, all in source order.
 */
function loadWordNet() {
  const dir = path.join(RAW, "oewn");
  const synsets: Record<string, any> = {};
  for (const f of fs.readdirSync(dir)) {
    if (/^(noun|verb|adj|adv)\./.test(f)) Object.assign(synsets, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
  // WordNet's own part-of-speech codes, spelled out (n, v, a, s = satellite adjective, r)
  const POS: Record<string, string> = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" };
  let count = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith("entries-"))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [lemma, byPos] of Object.entries<any>(data)) {
      const e = entryFor(lemma);
      if (!e.wn && /^[a-z]/.test(lemma)) e.w = lemma; // display the lowercase spelling when there is one
      for (const [posKey, info] of Object.entries<any>(byPos)) {
        const senses: Sense[] = [];
        for (const s of info.sense ?? []) {
          const ss = synsets[s.synset];
          if (!ss) continue;
          const members = (ss.members as string[]).filter((m) => m !== lemma).map((word) => ({ word }));
          const hypernyms = (ss.hypernym ?? []).flatMap((h: string) => (synsets[h]?.members ?? []).map((word: string) => ({ word })));
          senses.push(
            compact({
              gloss: (ss.definition ?? []).join("; "),
              examples: (ss.example ?? []).map((x: any): Example => compact({ text: typeof x === "string" ? x : x.text, ref: typeof x === "string" ? undefined : x.source })),
              relations: compact({ synonyms: members, hypernyms } as Relations),
            }),
          );
        }
        (e.wn ??= []).push(
          compact({
            word: lemma,
            pos: POS[posKey[0]] ?? posKey,
            pron: (info.pronunciation ?? []).map((p: any): Pron => compact({ text: p.value, kind: "ipa", tags: p.variety ? [p.variety] : undefined })),
            senses,
          }),
        );
        count++;
      }
    }
  }
  console.log(`wordnet: ${count} lemma/pos entries`);
}

// ---------------------------------------------------------------- Wiktionary (wiktextract)
async function* jsonl(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (++n > LIMIT) break;
    if (n % 200000 === 0) console.log(`  ${path.basename(file)}: ${n} lines`);
    yield JSON.parse(line);
  }
}

/**
 * wiktextract bookkeeping tags: they describe how wiktextract parsed the page, not the word, so they
 * are dropped. Every other tag is kept verbatim.
 */
const PARSER_TAGS = new Set(["table-tags", "inflection-template", "error-unknown-tag", "no-gloss", "class"]);
const tagsOf = (xs: unknown) => strs(xs)?.filter((t) => !PARSER_TAGS.has(t));

/** wiktextract prefixes the rendered etymology tree to the prose; keep only the prose. */
function etymologyText(text?: string): string | undefined {
  if (!text) return undefined;
  if (text.startsWith("Etymology tree")) {
    const lines = text.split("\n").filter(Boolean);
    text = lines[lines.length - 1];
  }
  return text.trim() || undefined;
}

function prons(o: any): Pron[] {
  const out: Pron[] = [];
  for (const s of o.sounds ?? []) {
    for (const kind of ["ipa", "enpr"] as const) if (s[kind]) out.push(compact({ text: s[kind], kind, tags: tagsOf(s.tags) }));
  }
  return out;
}

function audios(o: any): Audio[] {
  return (o.sounds ?? [])
    .filter((s: any) => typeof s.mp3_url === "string")
    .map((s: any): Audio => compact({ url: s.mp3_url, tags: tagsOf(s.tags) }));
}

/**
 * wiktextract mixes two things in `forms`: the headline forms printed next to the headword (no
 * `source`) and full inflection tables (`source: "conjugation" | "declension" | "inflection"`).
 * They are kept apart, each complete and in source order. Romanizations and hanja are pronunciation
 * and spelling data, stored in `pron` and `alt`.
 */
const isForm = (f: any) => f.form && !f.tags?.some((t: string) => PARSER_TAGS.has(t) || t === "romanization" || t === "hanja");
const form = (f: any): Form => compact({ form: f.form, tags: tagsOf(f.tags) });
function wiktForms(o: any): Form[] {
  return (o.forms ?? []).filter((f: any) => isForm(f) && !f.source).map(form);
}
function wiktTables(o: any): FormTable[] {
  const tables = new Map<string, Form[]>();
  for (const f of o.forms ?? []) {
    if (!isForm(f) || !f.source) continue;
    tables.set(f.source, [...(tables.get(f.source) ?? []), form(f)]);
  }
  return [...tables].map(([kind, forms]) => ({ kind, forms }));
}

const refs = (xs: any[] | undefined): WordRef[] =>
  (xs ?? []).filter((x) => x?.word).map((x) => compact({ word: x.word, note: x.english ?? x.translation, tags: tagsOf(x.tags) }));

function wiktRelations(o: any): Relations {
  const kinds: [RelationKind, string][] = [
    ["synonyms", "synonyms"],
    ["antonyms", "antonyms"],
    ["hypernyms", "hypernyms"],
    ["hyponyms", "hyponyms"],
    ["related", "related"],
    ["derived", "derived"],
  ];
  return compact(Object.fromEntries(kinds.map(([k, src]) => [k, refs(o[src])])) as Relations);
}

const isKo = (t: any) => (t.lang_code ?? t.code) === "ko" && t.word;
const translation = (t: any): Translation => compact({ word: t.word, lang: "ko", roman: t.roman, alt: t.alt, tags: tagsOf(t.tags) });

function wiktSenses(o: any): Sense[] {
  const out: Sense[] = [];
  for (const s of o.senses ?? []) {
    const glosses: string[] | undefined = s.glosses;
    if (!glosses?.length) continue;
    out.push(
      compact({
        gloss: glosses[glosses.length - 1],
        parent: glosses.length > 1 ? glosses.slice(0, -1).join(" › ") : undefined,
        tags: tagsOf(s.tags),
        formOf: [...(s.form_of ?? []), ...(s.alt_of ?? [])].map((x: any) => x.word).filter(Boolean),
        examples: (s.examples ?? [])
          .filter((x: any) => x.text)
          .map((x: any): Example => compact({ text: x.text, translation: x.english ?? x.translation, roman: x.roman, ref: x.ref })),
        relations: wiktRelations(s),
      }),
    );
  }
  return out;
}

function wiktEntry(o: any): DictEntry {
  return compact({
    word: o.word,
    pos: o.pos,
    etym: o.etymology_number ? Number(o.etymology_number) : undefined,
    alt: (o.forms ?? []).filter((f: any) => f.tags?.includes("hanja")).map((f: any) => f.form),
    pron: [
      ...prons(o),
      ...(o.forms ?? []).filter((f: any) => f.tags?.includes("romanization")).map((f: any): Pron => ({ text: f.form, kind: "romanization" })),
    ],
    audio: audios(o),
    forms: wiktForms(o),
    tables: wiktTables(o),
    etymology: etymologyText(o.etymology_text),
    senses: wiktSenses(o),
    relations: wiktRelations(o),
  });
}

// ---------------------------------------------------------------- Wiktionary: English entries (+ Korean translations)
/**
 * English entries go to `en`. Their Korean translations, which Wiktionary keeps per sense, go to
 * `enko` as an entry with the same headword and part of speech whose senses carry only the
 * translations. Each Korean word also gets a backlink: "given as a translation of <word> (<sense>)".
 */
async function loadWiktEnglish() {
  let count = 0;
  let translations = 0;
  for await (const o of jsonl(path.join(RAW, "en.jsonl.gz"))) {
    if (!o.word || o.lang_code !== "en") continue;
    const entry = wiktEntry(o);
    if (!entry.senses?.length) continue;
    const e = entryFor(o.word);
    (e.en ??= []).push(entry);
    count++;

    // Korean translations: on the entry (with a `sense` label) or on individual senses
    const tSenses: Sense[] = [];
    const byGloss = new Map<string, Sense>();
    const add = (gloss: string, t: any) => {
      let s = byGloss.get(gloss);
      if (!s) byGloss.set(gloss, (s = { gloss, translations: [] }));
      if (!s.translations!.some((x) => x.word === t.word && x.alt === t.alt)) s.translations!.push(translation(t));
    };
    for (const s of o.senses ?? []) for (const t of (s.translations ?? []).filter(isKo)) add(t.sense ?? s.glosses?.at(-1) ?? "", t);
    for (const t of (o.translations ?? []).filter(isKo)) add(t.sense ?? "", t);
    for (const s of byGloss.values()) tSenses.push(s);
    if (!tSenses.length) continue;
    (e.enko ??= []).push(compact({ word: o.word, pos: o.pos, etym: entry.etym, senses: tSenses }));
    for (const s of tSenses)
      for (const t of s.translations!) {
        const k = entryFor(t.word);
        const list = (k.koBacklinks ??= []);
        if (!list.some((b) => b.word === o.word && b.pos === o.pos && b.sense === s.gloss)) list.push({ word: o.word, lang: "en", pos: o.pos, sense: s.gloss });
        translations++;
      }
  }
  console.log(`wiktionary en: ${count} entries, ${translations} korean translations`);
}

// ---------------------------------------------------------------- Wiktionary: Korean entries
async function loadWiktKorean() {
  let count = 0;
  for await (const o of jsonl(path.join(RAW, "ko.jsonl.gz"))) {
    if (!o.word || o.lang_code !== "ko") continue;
    const entry = wiktEntry(o);
    if (!entry.senses?.length) continue;
    (entryFor(o.word).ko ??= []).push(entry);
    count++;
  }
  let backlinked = 0;
  for (const e of entries.values()) if (e.koBacklinks) backlinked++;
  console.log(`wiktionary ko: ${count} entries, ${backlinked} korean words with english backlinks`);
}

// ---------------------------------------------------------------- word frequency (search ranking only)
function loadFrequency() {
  const file = path.join(RAW, "wordfreq.json");
  if (!fs.existsSync(file)) return console.log("wordfreq: skipped (raw/wordfreq.json missing)");
  const freq: Record<"en" | "ko", Record<string, number>> = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  for (const [key, e] of entries) {
    const f = (/[\uac00-\ud7af]/.test(key) ? freq.ko : freq.en)[key];
    if (f) {
      e.freq = f;
      n++;
    }
  }
  console.log(`wordfreq: ${n} headwords with a frequency (used for search ranking only)`);
}

// ---------------------------------------------------------------- Tatoeba sentence pairs
/**
 * A pair is attached to a headword only when the headword occurs in it as an exact whole word:
 * English by token (and two-token phrases like "give up"), Korean by whitespace-separated word.
 * No stemming or other guessing, so 먹다 gets no pairs (Korean sentences contain 먹어, 먹었다…).
 */
function loadTatoeba() {
  const dir = path.join(RAW, "tatoeba");
  if (!fs.existsSync(path.join(dir, "eng-kor_links.tsv"))) return console.log("tatoeba: skipped (raw/tatoeba missing)");
  const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean);
  const kor = new Map(read("kor_sentences.tsv").map((l) => l.split("\t")).map(([id, , t]) => [id, t]));
  const links = read("eng-kor_links.tsv").map((l) => l.split("\t"));
  const engIds = new Set(links.map((l) => l[0]));
  const eng = new Map<string, string>();
  for (const l of read("eng_sentences.tsv")) {
    const id = l.slice(0, l.indexOf("\t"));
    if (engIds.has(id)) eng.set(id, l.split("\t")[2]);
  }
  const pairs: SentencePair[] = [];
  for (const [e, k] of links) {
    const en = eng.get(e);
    const ko = kor.get(k);
    if (en && ko) pairs.push({ en, ko });
  }
  let attached = 0;
  const add = (key: string, p: SentencePair) => {
    const e = entries.get(key);
    if (!e) return;
    const list = (e.pairs ??= []);
    if (!list.includes(p)) {
      list.push(p);
      attached++;
    }
  };
  for (const p of pairs) {
    const tokens = p.en.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
    for (let i = 0; i < tokens.length; i++) {
      add(tokens[i], p);
      if (tokens[i + 1]) add(`${tokens[i]} ${tokens[i + 1]}`, p);
    }
    for (const word of p.ko.split(/[\s.,!?"'()…·:;]+/).filter(Boolean)) if (entries.get(word)?.ko || entries.get(word)?.koBacklinks) add(word, p);
  }
  console.log(`tatoeba: ${pairs.length} sentence pairs, ${attached} exact word matches`);
}

// ---------------------------------------------------------------- output
function mask(e: Collected): number {
  return (e.wn ? DICT.wn : 0) | (e.en ? DICT.en : 0) | (e.enko ? DICT.enko : 0) | (e.ko || e.koBacklinks ? DICT.ko : 0);
}

function rmrf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

/** The part of a headword that belongs to one data set, or undefined if the word isn't in it. */
const PART: { [D in ChunkId]: (e: Collected) => DictData[D] | undefined } = {
  wn: (e) => e.wn,
  en: (e) => e.en,
  enko: (e) => e.enko,
  ko: (e) => (e.ko || e.koBacklinks ? compact({ entries: e.ko, backlinks: e.koBacklinks }) : undefined),
  ex: (e) => e.pairs,
};

/**
 * Headwords whose data is larger than this are written to their own file (d/<id>/x/<hash>.json) and
 * the chunk keeps a pointer { "$file": "<hash>" }. Nothing is cut; this only keeps one huge headword
 * (Korean 사: 174 hanja senses, 880 KB) from slowing down every other lookup in its chunk. The rule
 * is the same for every source.
 */
const OWN_FILE_BYTES = 64_000;

function writeEntries() {
  fs.rmSync(path.join(OUT, "e"), { recursive: true, force: true }); // pre-split layout
  const report: Record<string, unknown> = {};
  for (const id of Object.keys(SHARDS) as ChunkId[]) {
    const dir = path.join(OUT, "d", id);
    rmrf(dir);
    const shards = new Map<string, Record<string, unknown>>();
    let count = 0;
    let ownFiles = 0;
    for (const [key, e] of entries) {
      const part = PART[id](e);
      if (!part) continue;
      const s = shardOf(key, SHARDS[id]);
      let shard = shards.get(s);
      if (!shard) shards.set(s, (shard = {}));
      const json = JSON.stringify(part);
      if (json.length > OWN_FILE_BYTES) {
        const file = ownFileName(key);
        fs.mkdirSync(path.join(dir, "x"), { recursive: true });
        writeData(path.join(dir, "x", `${file}.json`), json);
        shard[key] = { $file: file };
        ownFiles++;
      } else shard[key] = part;
      count++;
    }
    let bytes = 0;
    let gz = 0;
    let max = 0;
    let i = 0;
    for (const [s, shard] of shards) {
      const json = JSON.stringify(shard);
      bytes += json.length;
      max = Math.max(max, json.length);
      if (i++ % 16 === 0) gz += zlib.gzipSync(json).length * 16; // sampled compressed size
      writeData(path.join(dir, `${s}.json`), json);
    }
    report[id] = { headwords: count, chunks: shards.size, ownFiles, mb: +(bytes / 1e6).toFixed(0), avgKb: +(bytes / shards.size / 1e3).toFixed(0), maxKb: +(max / 1e3).toFixed(0), avgGzKb: +(gz / shards.size / 1e3).toFixed(0) };
    console.log(`entries ${id}:`, JSON.stringify(report[id]));
  }
  return report;
}

/**
 * Search index: all headwords sorted by fold key and cut into fixed-size chunks.
 *
 *   i/manifest.json   { chunk: CHUNK, first: string[] }   first fold key of every chunk
 *   i/<n>.json        { rows: IndexRow[], tops: { [prefix]: IndexRow[] } }
 *
 * A prefix with at most CHUNK matches spans at most two chunks, so the client loads them and
 * ranks the matches itself. Larger prefixes get a precomputed top list stored in the chunk that
 * holds their first row. This keeps the index at a few hundred files (Workers free plan: 20k files).
 */
const CHUNK = 2500;
const TOP_N = 15;
const TOP_MAX_LEN = 16;

function writeIndex() {
  const dir = path.join(OUT, "i");
  rmrf(dir);
  const rows: { f: string; cp: string[]; row: IndexRow; s: number }[] = [];
  for (const e of entries.values()) {
    const f = foldKey(e.w);
    if (!f) continue;
    const row: IndexRow = e.freq ? [e.w, mask(e), Math.round(e.freq * 10)] : [e.w, mask(e)];
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
        const best = rows.slice(start, end).sort((a, b) => a.s - b.s).slice(0, TOP_N).map((r) => r.row);
        tops[Math.floor(start / CHUNK)][prefix] = best;
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
  writeData(path.join(dir, "manifest.json"), JSON.stringify({ chunk: CHUNK, first }));
  console.log(`index: ${rows.length} rows in ${chunks} chunks, ${topCount} precomputed prefixes`);
}

function writeMeta(sizes: Record<string, unknown>) {
  const stats = { headwords: entries.size, wn: 0, en: 0, enko: 0, ko: 0 };
  for (const e of entries.values()) {
    if (e.wn) stats.wn++;
    if (e.en) stats.en++;
    if (e.enko) stats.enko++;
    if (e.ko || e.koBacklinks) stats.ko++;
  }
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ builtAt: new Date().toISOString(), stats, sizes }, null, 2));
  console.log("stats", stats);
}

const t0 = Date.now();
loadWordNet();
await loadWiktEnglish();
await loadWiktKorean();
loadFrequency();
loadTatoeba();
const sizes = writeEntries();
writeIndex();
writeMeta(sizes);
const version = contentHash.digest("hex").slice(0, 12);
fs.writeFileSync(path.join(OUT, "version.txt"), version);
console.log("data version", version);
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s, peak RSS ${(process.resourceUsage().maxRSS / 1024 / 1024).toFixed(1)} GB`);
