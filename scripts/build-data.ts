// Converts raw sources into the static data files served by the site.
//
//   raw/oewn/*.json      Open English WordNet 2025 (JSON release)
//   raw/en.jsonl.gz      Wiktionary English entries (kaikki.org / wiktextract)
//   raw/ko.jsonl.gz      Wiktionary Korean entries  (kaikki.org / wiktextract)
//   raw/wordfreq.json    word frequency (wordfreq 3.1, Zipf scale)          optional
//   raw/tatoeba/*.tsv    English–Korean sentence pairs (Tatoeba)          optional
//
// Output:
//   data/site/d/<id>/<shard>.json    per-data-set chunks, { [entryKey]: DictData[id] }, SHARDS[id] files
//                                    (wn, en, enko, ko dictionaries; ex = sentence pairs)
//   data/site/i/manifest.json        first key of each search index chunk
//   data/site/i/<n>.json             search index chunks: headword, dictionary bitmask, frequency
//   data/site/meta.json              build stats shown on the site
//
// Run: node --max-old-space-size=8000 scripts/build-data.ts

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { type ChunkId, DICT, entryKey, foldKey, rankScore, SHARDS, shardOf } from "../app/lib/keys.ts";
import type {
  Audio,
  DictData,
  EnKoGroup,
  SentencePair,
  Entry,
  IndexRow,
  KoReverse,
  WiktEntry,
  WiktSense,
  WnEntry,
} from "../app/lib/types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "data", "site");
const LIMIT = Number(process.env.LIMIT ?? Infinity); // lines per Wiktionary file (dev)

const entries = new Map<string, Entry>();
function entryFor(display: string): Entry {
  const key = entryKey(display);
  let e = entries.get(key);
  if (!e) {
    e = { w: display };
    entries.set(key, e);
  }
  return e;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const uniq = <T>(xs: T[]) => [...new Set(xs)];

// ---------------------------------------------------------------- WordNet
function loadWordNet() {
  const dir = path.join(RAW, "oewn");
  const synsets: Record<string, any> = {};
  for (const f of fs.readdirSync(dir)) {
    if (/^(noun|verb|adj|adv)\./.test(f)) Object.assign(synsets, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
  const POS: Record<string, string> = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" };
  let count = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith("entries-"))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [lemma, byPos] of Object.entries<any>(data)) {
      const e = entryFor(lemma);
      if (e.wn === undefined && /^[a-z]/.test(lemma)) e.w = lemma; // prefer lowercase display
      for (const [posKey, info] of Object.entries<any>(byPos)) {
        const wn: WnEntry = {
          lemma,
          pos: POS[posKey[0]] ?? posKey,
          pron: info.pronunciation?.map((p: any) => (p.variety ? { v: p.value, var: p.variety } : { v: p.value })),
          senses: [],
        };
        for (const s of info.sense ?? []) {
          const ss = synsets[s.synset];
          if (!ss) continue;
          const syn = (ss.members as string[]).filter((m) => m !== lemma).slice(0, 8);
          const broader = uniq((ss.hypernym ?? []).flatMap((h: string) => synsets[h]?.members?.slice(0, 2) ?? [])).slice(0, 4) as string[];
          const ex = (ss.example ?? []).map((x: any) => (typeof x === "string" ? x : x.text)).slice(0, 3);
          wn.senses.push({
            def: ss.definition?.[0] ?? "",
            ...(ex.length ? { ex } : {}),
            ...(syn.length ? { syn } : {}),
            ...(broader.length ? { broader } : {}),
          });
        }
        (e.wn ??= []).push(wn);
        count++;
      }
    }
  }
  console.log(`wordnet: ${count} lemma/pos entries`);
}

// ---------------------------------------------------------------- Wiktionary helpers
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

const HIDDEN_TAGS = new Set(["form-of", "alt-of", "no-gloss", "Hanja", "hanja", "abbreviation", "morpheme", "error-unknown-tag"]);

function etymology(text?: string): string | undefined {
  if (!text) return undefined;
  if (text.startsWith("Etymology tree")) {
    // wiktextract prefixes the rendered tree; the prose is the last paragraph
    const lines = text.split("\n").filter(Boolean);
    text = lines[lines.length - 1];
  }
  return clip(text.trim(), 1200) || undefined;
}

function sounds(o: any) {
  const ipa = (o.sounds ?? [])
    .filter((s: any) => s.ipa)
    .slice(0, 4)
    .map((s: any) => (s.tags?.length ? { v: s.ipa, tags: s.tags.slice(0, 3) } : { v: s.ipa }));
  return ipa.length ? ipa : undefined;
}

const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/";
/** Accent label for a recording: US / UK when known, otherwise the first tag. */
function accent(tags: string[] = []): string | undefined {
  if (tags.some((t) => /^(US|General-American)$/.test(t))) return "US";
  if (tags.some((t) => /^(UK|Received-Pronunciation|Southern-England)$/.test(t))) return "UK";
  return tags[0];
}
/** Up to two recordings (prefer one US + one UK), as paths under Wikimedia Commons. */
function audio(o: any): Audio[] | undefined {
  const all: Audio[] = (o.sounds ?? [])
    .filter((s: any) => typeof s.mp3_url === "string" && s.mp3_url.startsWith(COMMONS))
    .map((s: any) => ({ ...(accent(s.tags) && { tag: accent(s.tags) }), mp3: s.mp3_url.slice(COMMONS.length) }));
  const pick: Audio[] = [];
  for (const want of ["US", "UK"]) {
    const a = all.find((x) => x.tag === want);
    if (a) pick.push(a);
  }
  if (!pick.length && all[0]) pick.push(all[0]);
  return pick.length ? pick : undefined;
}

/** Inflected forms worth showing (plural, past, participles, comparative); drops spelling variants. */
const FORM_SKIP = [
  "table-tags", "inflection-template", "romanization", "canonical", "alternative", "obsolete", "archaic",
  "class", "hanja", "nonstandard", "colloquial", "dialectal", "rare", "second-person", "first-person",
];
function forms(o: any) {
  const seen = new Set<string>();
  const out = (o.forms ?? [])
    .filter((f: any) => f.form && f.form !== o.word && f.form !== "-" && !f.tags?.some((t: string) => FORM_SKIP.includes(t)))
    .filter((f: any) => !seen.has(f.form) && seen.add(f.form)) // "ran" once, not per person
    .slice(0, 6)
    .map((f: any) => (f.tags?.length ? { f: f.form, tags: f.tags.slice(0, 3) } : { f: f.form }));
  return out.length ? out : undefined;
}

/** Derived words (사랑 -> 사랑하다, 사랑니), shortest/plainest first. */
function derived(o: any) {
  const list = [...(o.derived ?? []), ...(o.senses ?? []).flatMap((s: any) => s.derived ?? [])]
    .filter((d: any) => d.word && d.word !== o.word && !/[()]/.test(d.word))
    .map((d: any) => ({ w: d.word as string, ...(d.english && { en: clip(d.english, 60) }) }));
  const seen = new Set<string>();
  const out = list.filter((d) => !seen.has(d.w) && seen.add(d.w)).sort((a, b) => a.w.length - b.w.length).slice(0, 12);
  return out.length ? out : undefined;
}

function senses(o: any, korean: boolean): WiktSense[] {
  const out: WiktSense[] = [];
  for (const s of o.senses ?? []) {
    const glosses: string[] | undefined = s.glosses;
    if (!glosses?.length) continue;
    const sense: WiktSense = { g: clip(glosses[glosses.length - 1], 600) };
    if (glosses.length > 1) sense.parent = clip(glosses[0], 300);
    const tags = (s.tags ?? []).filter((t: string) => !HIDDEN_TAGS.has(t)).slice(0, 4);
    if (tags.length) sense.tags = tags;
    const exs = (s.examples ?? []).filter((x: any) => x.text);
    const picked = [...exs.filter((x: any) => x.type !== "quotation"), ...exs.filter((x: any) => x.type === "quotation")].slice(0, korean ? 3 : 2);
    if (picked.length)
      sense.ex = picked.map((x: any) => {
        const ex: { t: string; roman?: string; en?: string } = { t: clip(x.text, 300) };
        if (x.roman) ex.roman = clip(x.roman, 300);
        const en = x.english ?? x.translation;
        if (en) ex.en = clip(en, 300);
        return ex;
      });
    const syn = (s.synonyms ?? []).map((x: any) => x.word).filter(Boolean).slice(0, 8);
    if (syn.length) sense.syn = syn;
    const of = s.form_of?.[0]?.word ?? s.alt_of?.[0]?.word;
    if (of && of !== o.word) sense.of = of;
    out.push(sense);
  }
  return out;
}

// ---------------------------------------------------------------- Wiktionary English
const koReverse = new Map<string, KoReverse[]>();

async function loadWiktEnglish() {
  let count = 0;
  let translations = 0;
  for await (const o of jsonl(path.join(RAW, "en.jsonl.gz"))) {
    if (!o.word || o.lang_code !== "en") continue;
    const ss = senses(o, false);
    if (!ss.length) continue;
    const we: WiktEntry = { word: o.word, pos: o.pos, senses: ss };
    if (o.etymology_number) we.etym = Number(o.etymology_number);
    const ipa = sounds(o);
    if (ipa) we.ipa = ipa;
    const rec = audio(o);
    if (rec) we.audio = rec;
    const ety = etymology(o.etymology_text);
    if (ety) we.ety = ety;
    const f = forms(o);
    if (f) we.forms = f;
    const d = derived(o);
    if (d) we.derived = d;
    const e = entryFor(o.word);
    (e.en ??= []).push(we);
    count++;

    // Korean translations, grouped by the translated sense
    // (wiktextract puts them either on the entry or on individual senses)
    const isKo = (t: any) => (t.lang_code ?? t.code) === "ko" && t.word;
    const ko = [
      ...(o.translations ?? []).filter(isKo),
      ...(o.senses ?? []).flatMap((s: any) =>
        (s.translations ?? []).filter(isKo).map((t: any) => ({ ...t, sense: t.sense ?? s.glosses?.at(-1) })),
      ),
    ];
    if (ko.length) {
      const groups = new Map<string, EnKoGroup>();
      for (const t of ko) {
        const sense = clip(t.sense ?? "", 200);
        let g = groups.get(sense);
        if (!g) groups.set(sense, (g = { word: o.word, pos: o.pos, sense, ko: [] }));
        if (g.ko.some((k) => k.w === t.word)) continue;
        g.ko.push({ w: t.word, ...(t.roman && { roman: t.roman }), ...(t.alt && { alt: t.alt }), ...(t.tags?.length && { tags: t.tags.slice(0, 3) }) });
        translations++;
        const rk = entryKey(t.word);
        const rev = koReverse.get(rk) ?? [];
        if (rev.length < 40 && !rev.some((r) => r.en === o.word && r.sense === sense)) rev.push({ en: o.word, pos: o.pos, sense });
        koReverse.set(rk, rev);
      }
      (e.enko ??= []).push(...groups.values());
    }
  }
  console.log(`wiktionary en: ${count} entries, ${translations} korean translations`);
}

// ---------------------------------------------------------------- Wiktionary Korean
async function loadWiktKorean() {
  let count = 0;
  for await (const o of jsonl(path.join(RAW, "ko.jsonl.gz"))) {
    if (!o.word || o.lang_code !== "ko" || o.pos === "romanization") continue;
    const ss = senses(o, true);
    if (!ss.length) continue;
    const we: WiktEntry = { word: o.word, pos: o.pos, senses: ss };
    if (o.etymology_number) we.etym = Number(o.etymology_number);
    const ipa = sounds(o);
    if (ipa) we.ipa = ipa.slice(0, 2);
    const rec = audio(o);
    if (rec) we.audio = rec;
    const ety = etymology(o.etymology_text);
    if (ety) we.ety = ety;
    const d = derived(o);
    if (d) we.derived = d;
    const roman = o.forms?.find((f: any) => f.tags?.includes("romanization"))?.form;
    if (roman) we.roman = roman;
    const hanja = o.forms?.find((f: any) => f.tags?.includes("hanja"))?.form;
    if (hanja) we.hanja = hanja;
    (entryFor(o.word).ko ??= []).push(we);
    count++;
  }
  for (const [key, rev] of koReverse) (entries.get(key) ?? entryFor(key)).koRev = rev;
  console.log(`wiktionary ko: ${count} entries, ${koReverse.size} reverse-translated korean words`);
}

// ---------------------------------------------------------------- word frequency (wordfreq, CC BY-SA 4.0)
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
  console.log(`wordfreq: ${n} headwords with a frequency`);
}

// ---------------------------------------------------------------- example sentence pairs (Tatoeba, CC BY 2.0 FR)
/**
 * English–Korean sentence pairs, attached to the headwords they contain. English words are matched
 * by token; Korean headwords by their stem (먹다 -> 먹) at a word start, which catches 먹었다/먹어 too.
 */
const pairsByKey = new Map<string, SentencePair[]>();
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
  const seen = new Set<string>();
  const pairs: SentencePair[] = [];
  for (const [e, k] of links) {
    const en = eng.get(e);
    const ko = kor.get(k);
    if (!en || !ko || seen.has(en)) continue; // one Korean translation per English sentence
    seen.add(en);
    pairs.push({ en, ko });
  }
  // shortest sentences first so each word keeps its simplest examples
  pairs.sort((a, b) => a.en.length - b.en.length);
  const add = (key: string, p: SentencePair) => {
    const list = pairsByKey.get(key) ?? [];
    if (list.length < 5 && !list.includes(p)) list.push(p);
    pairsByKey.set(key, list);
  };
  // English: every token and adjacent token pair ("give up") that is a headword
  for (const p of pairs) {
    const tokens = p.en.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
    for (let i = 0; i < tokens.length; i++) {
      for (const k of [tokens[i], tokens[i + 1] && `${tokens[i]} ${tokens[i + 1]}`]) if (k && entries.get(k)?.enko) add(k, p);
    }
  }
  // Korean: headwords with English translations, matched by stem at a word start
  const koHeads = [...entries.keys()].filter((k) => /^[\uac00-\ud7af]+$/.test(k) && (entries.get(k)!.ko || entries.get(k)!.koRev));
  for (const k of koHeads) {
    const stem = k.endsWith("다") && k.length > 1 ? k.slice(0, -1) : k;
    if (stem.length < 1) continue;
    const re = new RegExp(`(^|[\\s"'(])${stem}`);
    for (const p of pairs) if (re.test(p.ko)) add(k, p);
  }
  for (const [key, list] of pairsByKey) entries.get(key)!.pairs = list;
  console.log(`tatoeba: ${pairs.length} sentence pairs, attached to ${pairsByKey.size} headwords`);
}

// ---------------------------------------------------------------- output
function mask(e: Entry): number {
  return (e.wn ? DICT.wn : 0) | (e.en ? DICT.en : 0) | (e.enko ? DICT.enko : 0) | (e.ko || e.koRev ? DICT.ko : 0);
}

function rmrf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

/** The part of an entry that belongs to one data set, or undefined if the word isn't in it. */
const PART: { [D in ChunkId]: (e: Entry) => DictData[D] | undefined } = {
  wn: (e) => e.wn,
  en: (e) => e.en,
  enko: (e) => e.enko,
  ko: (e) => (e.ko || e.koRev ? { ...(e.ko && { ko: e.ko }), ...(e.koRev && { rev: e.koRev }) } : undefined),
  ex: (e) => e.pairs,
};

function writeEntries() {
  rmrf(path.join(OUT, "e")); // pre-split layout
  for (const dict of Object.keys(SHARDS) as ChunkId[]) {
    const dir = path.join(OUT, "d", dict);
    rmrf(dir);
    const shards = new Map<string, Record<string, unknown>>();
    let count = 0;
    for (const [key, e] of entries) {
      const part = PART[dict](e);
      if (!part) continue;
      const s = shardOf(key, SHARDS[dict]);
      let shard = shards.get(s);
      if (!shard) shards.set(s, (shard = {}));
      shard[key] = part;
      count++;
    }
    let bytes = 0;
    let max = 0;
    for (const [s, shard] of shards) {
      const json = JSON.stringify(shard);
      bytes += json.length;
      max = Math.max(max, json.length);
      fs.writeFileSync(path.join(dir, `${s}.json`), json);
    }
    console.log(
      `entries ${dict}: ${count} headwords in ${shards.size} chunks, ${(bytes / 1e6).toFixed(0)} MB, avg ${(bytes / shards.size / 1e3).toFixed(0)} KB, max ${(max / 1e3).toFixed(0)} KB`,
    );
  }
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
    fs.writeFileSync(path.join(dir, `${c}.json`), JSON.stringify({ rows: slice.map((r) => r.row), tops: tops[c] }));
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ chunk: CHUNK, first }));
  console.log(`index: ${rows.length} rows in ${chunks} chunks, ${topCount} precomputed prefixes`);
}

function writeMeta() {
  const stats = { headwords: entries.size, wn: 0, en: 0, enko: 0, ko: 0 };
  for (const e of entries.values()) {
    if (e.wn) stats.wn++;
    if (e.en) stats.en++;
    if (e.enko) stats.enko++;
    if (e.ko || e.koRev) stats.ko++;
  }
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ builtAt: new Date().toISOString(), stats }, null, 2));
  console.log("stats", stats);
}

const t0 = Date.now();
loadWordNet();
await loadWiktEnglish();
await loadWiktKorean();
loadFrequency();
loadTatoeba();
writeEntries();
writeIndex();
writeMeta();
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s, peak RSS ${(process.resourceUsage().maxRSS / 1024 / 1024).toFixed(1)} GB`);
