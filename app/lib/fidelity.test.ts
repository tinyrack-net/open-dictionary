// The converters must copy sources faithfully (see the rules in types.ts). These checks compare the
// built data (data/site) with the raw source (raw/en.jsonl.gz) for real headwords, so they fail if a
// converter merges, drops, reorders, truncates or invents anything. Skipped without the data.
import assert from "node:assert/strict";
import fs from "node:fs";
import readline from "node:readline";
import { test } from "node:test";
import zlib from "node:zlib";
import { TAG_KO } from "../locales/tags.ko.ts";
import { entryKey, shardOf } from "./keys.ts";
import type { DictEntry, DictPart } from "./types.ts";

const DATA = new URL("../../data/site/", import.meta.url);
const RAW = new URL("../../raw/en.jsonl.gz", import.meta.url);
const haveData = fs.existsSync(new URL("i/manifest.json", DATA)) && fs.existsSync(RAW);

const SHARDS: Record<string, number> = fs.existsSync(new URL("i/manifest.json", DATA)) ? JSON.parse(fs.readFileSync(new URL("i/manifest.json", DATA), "utf8")).shards : {};

/** A dictionary's entries for a headword in the built data. */
const entries = (id: string, word: string): DictEntry[] | undefined => part(id, word)?.entries;

/** What dictionary `id` has for a headword in the built data. */
function part(id: string, word: string): DictPart | undefined {
  const key = entryKey(word);
  if (!SHARDS[id]) return undefined;
  const file = new URL(`d/${id}/${shardOf(key, SHARDS[id])}.json`, DATA);
  if (!fs.existsSync(file)) return undefined;
  const v = JSON.parse(fs.readFileSync(file, "utf8"))[key];
  if (v && typeof v === "object" && "$file" in v) return JSON.parse(fs.readFileSync(new URL(`d/${id}/x/${v.$file}.json`, DATA), "utf8"));
  return v;
}

/**
 * Raw wiktextract English entries for the given headword keys, in file order. Keys are lowercase,
 * like the built data: "do" collects both "do" and "DO".
 */
async function raw(words: string[]): Promise<Map<string, any[]>> {
  const want = new Set(words.map(entryKey));
  const out = new Map<string, any[]>(words.map((w) => [entryKey(w), []]));
  const rl = readline.createInterface({ input: fs.createReadStream(RAW).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    const m = /"word": "([^"]*)", "lang": "English"/.exec(line);
    if (!m || !want.has(entryKey(m[1]))) continue;
    const o = JSON.parse(line);
    if (o.lang_code === "en" && o.senses?.some((s: any) => s.glosses?.length)) out.get(entryKey(o.word))!.push(o);
  }
  return out;
}

const WORDS = ["do", "run", "ran", "love", "give up", "water"];
let RAW_ENTRIES: Map<string, any[]>;

test("raw entries load", { skip: !haveData }, async () => {
  RAW_ENTRIES = await raw(WORDS);
  for (const w of WORDS) assert.ok(RAW_ENTRIES.get(w)!.length > 0, w);
});

test("one built entry per source entry, same order, same part of speech and etymology", { skip: !haveData }, () => {
  for (const w of WORDS) {
    const built = entries("wiktionary", w)!;
    const src = RAW_ENTRIES.get(w)!;
    assert.deepEqual(
      built.map((e) => [e.pos, e.etym]),
      src.map((o) => [o.pos, o.etymology_number ? Number(o.etymology_number) : undefined]),
      w,
    );
    assert.deepEqual(
      built.map((e) => e.word),
      src.map((o) => o.word),
      w,
    );
  }
});

test("forms stay with their own entry and keep the source's tags (do: verb forms vs noun plurals)", { skip: !haveData }, () => {
  const built = entries("wiktionary", "do")!;
  const verb = built.find((e) => e.pos === "verb")!;
  const party = built.find((e) => e.pos === "noun" && e.etym === 1)!;
  // the source's headline forms, in order: inflections, then its listed alternatives (Northumbrian de, dee)
  assert.deepEqual(
    verb.forms?.map((f) => f.form),
    ["does", "doing", "did", "done", "de", "dee"],
  );
  assert.deepEqual(verb.forms?.find((f) => f.form === "de")?.tags, ["alternative", "Northumbria"]);
  assert.deepEqual(verb.forms?.find((f) => f.form === "does")?.tags, ["present", "singular", "third-person"]);
  assert.ok(!verb.forms?.some((f) => f.form === "dos"), "noun plurals must not appear on the verb");
  // the full conjugation table is kept, separately and complete (doest, dost, didst, …)
  const table = verb.tables?.find((x) => x.kind === "conjugation");
  assert.ok(table && table.forms.some((f) => f.form === "didst" && f.tags?.includes("archaic")));
  assert.ok(party.forms?.some((f) => f.form === "do's" && f.tags?.includes("plural")));
  assert.ok(!party.forms?.some((f) => f.form === "did"));
});

test("every sense is kept, in order, with its full gloss", { skip: !haveData }, () => {
  for (const w of WORDS) {
    const built = entries("wiktionary", w)!;
    const src = RAW_ENTRIES.get(w)!;
    built.forEach((e: DictEntry, i) => {
      const glosses = src[i].senses.filter((s: any) => s.glosses?.length).map((s: any) => s.glosses.at(-1));
      assert.deepEqual(
        e.senses.map((s) => s.gloss),
        glosses,
        `${w} ${e.pos}`,
      );
    });
  }
});

test("examples are complete (no truncation, no cap)", { skip: !haveData }, () => {
  for (const w of WORDS) {
    const built = entries("wiktionary", w)!;
    const src = RAW_ENTRIES.get(w)!;
    built.forEach((e, i) => {
      const srcExamples = src[i].senses.filter((s: any) => s.glosses?.length).flatMap((s: any) => (s.examples ?? []).filter((x: any) => x.text).map((x: any) => x.text));
      assert.deepEqual(
        e.senses.flatMap((s) => (s.examples ?? []).map((x) => x.text)),
        srcExamples,
        `${w} ${e.pos}`,
      );
    });
  }
});

test("ran: the source's form-of senses are kept as written, nothing is guessed", { skip: !haveData }, () => {
  const senses = entries("wiktionary", "ran")!.flatMap((e) => e.senses);
  const runSense = senses.find((s) => s.formOf?.includes("run"));
  assert.ok(runSense, "ran has a sense that is a form of run");
  assert.match(runSense!.gloss, /run/);
});

test("built data has no fields the format doesn't define (no summaries, ratings, merged lists)", { skip: !haveData }, () => {
  const allowed = {
    entry: new Set(["word", "pos", "etym", "alt", "pron", "audio", "forms", "tables", "etymology", "notes", "senses", "relations"]),
    sense: new Set(["gloss", "glosses", "notes", "parent", "tags", "formOf", "examples", "translations", "relations"]),
  };
  for (const w of [...WORDS, "사랑", "먹다", "사과"])
    for (const id of Object.keys(SHARDS))
      for (const e of part(id, w)?.entries ?? []) {
        for (const k of Object.keys(e)) assert.ok(allowed.entry.has(k), `${id} ${w}: entry.${k}`);
        for (const s of e.senses) for (const k of Object.keys(s)) assert.ok(allowed.sense.has(k), `${id} ${w}: sense.${k}`);
      }
});

test("Korean tag table is 1:1 (no two source tags share a label unless they are synonyms)", () => {
  const SYNONYMS = new Set(["UK|GB|British", "rare|uncommon", "initialism|acronym", "specifically|especially"]);
  const byLabel = new Map<string, string[]>();
  for (const [tag, label] of Object.entries(TAG_KO)) byLabel.set(label, [...(byLabel.get(label) ?? []), tag]);
  for (const [label, tags] of byLabel)
    if (tags.length > 1) assert.ok(SYNONYMS.has(tags.join("|")), `${label} <- ${tags.join(", ")}`);
});

// ---------------------------------------------------------------- 한국어기초사전 (krdict)
const KRDICT = new URL("../../raw/krdict/", import.meta.url);
const haveKrdict = fs.existsSync(new URL("i/manifest.json", DATA)) && fs.existsSync(KRDICT);
const list = <T>(x: T | T[] | undefined | null): T[] => (Array.isArray(x) ? x : x == null ? [] : [x]);
/** The export's XML escapes and <I> italics are encoding; the comparison decodes them the same way. */
const decode = (v: string) =>
  v
    .replace(/&(quot|apos|lt|gt|lsqb|rsqb);/g, (_, e: string) => ({ quot: '"', apos: "'", lt: "<", gt: ">", lsqb: "[", rsqb: "]" })[e]!)
    .replace(/<\/?I>/gi, "")
    .replace(/&amp;/g, "&");
function feats(f: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const x of list<any>(f)) if (x?.att && typeof x.val === "string") (out[x.att] ??= []).push(decode(x.val));
  return out;
}
/** Raw krdict entries for the given headwords, in the export's order (files 1_, 2_, … 10_). */
function rawKrdict(words: string[]): Map<string, any[]> {
  const out = new Map<string, any[]>(words.map((w) => [w, []]));
  const files = fs.readdirSync(KRDICT).filter((f) => f.endsWith(".json")).sort((a, b) => parseInt(a) - parseInt(b));
  for (const f of files)
    for (const e of JSON.parse(fs.readFileSync(new URL(f, KRDICT), "utf8")).LexicalResource.Lexicon.LexicalEntry) {
      const w = list<any>(e.Lemma).map((l) => feats(l.feat).writtenForm?.[0]).find(Boolean);
      if (w) out.get(w)?.push(e);
    }
  return out;
}
const KR_WORDS = ["먹다", "사과", "첨예하다", "코웃음(을) 치다"];

test("krdict: one entry per source entry, in order, with every sense, definition and English equivalent", { skip: !haveKrdict }, () => {
  const raw = rawKrdict(KR_WORDS);
  for (const w of KR_WORDS) {
    const src = raw.get(w)!;
    const built = part("krdict", w)?.entries ?? [];
    assert.ok(src.length > 0, `${w}: in the source`);
    assert.equal(built.length, src.length, `${w}: entry count`);
    built.forEach((e, i) => {
      const senses = list<any>(src[i].Sense);
      assert.deepEqual(
        e.senses.map((s) => s.gloss),
        senses.map((s) => feats(s.feat).definition[0].trim()),
        `${w} ${i}: definitions`,
      );
      const en = (s: any) => list<any>(s.Equivalent).map((q) => feats(q.feat)).filter((q) => q.language?.[0] === "영어");
      assert.deepEqual(
        e.senses.map((s) => s.glosses?.map((g) => g.text) ?? []),
        senses.map((s) => en(s).map((q) => q.definition[0].trim())),
        `${w} ${i}: English definitions`,
      );
      // "eat; have; consume" is split into one translation per word, nothing else changes
      assert.deepEqual(
        e.senses.map((s) => (s.translations ?? []).map((x) => x.word).join("; ")),
        senses.map((s) => en(s).map((q) => q.lemma[0].split(/\s*;\s*/).filter(Boolean).join("; ")).join("; ")),
        `${w} ${i}: English equivalents`,
      );
      assert.deepEqual(
        e.senses.map((s) => (s.examples ?? []).length),
        senses.map((s) => list<any>(s.SenseExample).length),
        `${w} ${i}: example count`,
      );
    });
  }
});

test("krdict: homographs keep their own number, hanja and part of speech (사과 沙果 / 謝過)", { skip: !haveKrdict }, () => {
  const built = part("krdict", "사과")!.entries!;
  assert.deepEqual(
    built.map((e) => [e.etym, e.alt, e.pos, e.senses[0].translations?.[0]?.word]),
    [
      [1, ["沙果/砂果"], "명사", "apple"],
      [2, ["謝過"], "명사", "apology"],
    ],
  );
});

test("krdict: a dialogue example keeps every turn, in order", { skip: !haveKrdict }, () => {
  const raw = rawKrdict(["첨예하다"]).get("첨예하다")!;
  const dialogue = list<any>(raw[0].Sense)
    .flatMap((s) => list<any>(s.SenseExample))
    .map((x) => feats(x.feat))
    .find((x) => x.type?.[0] === "대화");
  if (!dialogue) return;
  const built = part("krdict", "첨예하다")!.entries![0].senses.flatMap((s) => s.examples ?? []);
  assert.ok(built.some((x) => x.text === dialogue.example.map((t) => t.trim()).join("\n")));
});

test("krdict: English words list the Korean words that have them as an equivalent", { skip: !haveKrdict }, () => {
  const apple = part("krdict", "apple")?.backlinks ?? [];
  assert.ok(apple.some((b) => b.word === "사과" && b.lang === "ko"), "apple <- 사과");
  const uncertainty = part("krdict", "uncertainty")?.backlinks ?? [];
  assert.ok(uncertainty.some((b) => b.word === "불확실성"), "uncertainty <- 불확실성");
  // a backlink only exists when the source lists the word as an equivalent; it is never guessed
  assert.ok(!part("krdict", "apple")?.entries, "apple has no krdict entry of its own");
});

// ---------------------------------------------------------------- Korean Wiktionary: English entries
const KOWIKT = new URL("../../raw/kowikt-en.jsonl.gz", import.meta.url);
const haveKowikt = fs.existsSync(new URL("i/manifest.json", DATA)) && fs.existsSync(KOWIKT);

test("kowiktionary: every English entry and sense is kept, in order, with its Korean gloss", { skip: !haveKowikt }, async () => {
  const words = ["run", "happy", "dictionary"];
  const src = new Map<string, any[]>(words.map((w) => [w, []]));
  const rl = readline.createInterface({ input: fs.createReadStream(KOWIKT).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    const o = JSON.parse(line);
    if (o.lang_code === "en" && src.has(o.word) && o.senses?.some((s: any) => s.glosses?.length)) src.get(o.word)!.push(o);
  }
  for (const w of words) {
    const built = entries("en-ko-kowiktionary", w)!;
    assert.deepEqual(
      built.map((e) => e.pos),
      src.get(w)!.map((o) => o.pos),
      w,
    );
    built.forEach((e, i) =>
      assert.deepEqual(
        e.senses.map((s) => s.gloss),
        src.get(w)![i].senses.filter((s: any) => s.glosses?.length).map((s: any) => s.glosses.at(-1)),
        `${w} ${e.pos}`,
      ),
    );
  }
});

test("krdict: escaped quotes in the source show as quotes (먹다: '-어 먹다'로 쓴다)", { skip: !haveKrdict }, () => {
  const notes = part("krdict", "먹다")!.entries!.flatMap((e) => e.senses.flatMap((s) => s.notes ?? []));
  assert.ok(notes.some((n) => n.includes("'-어 먹다'")), notes.join(" | "));
  assert.ok(!JSON.stringify(part("krdict", "먹다")).includes("&apos;"));
});

test("krdict: only text is used; no recordings or other media files (they are licensed per file)", { skip: !haveKrdict }, () => {
  for (const w of [...KR_WORDS, "첨예하다"]) {
    const json = JSON.stringify(part("krdict", w));
    assert.ok(!json.includes("dicmedia.korean.go.kr"), w);
    for (const e of part("krdict", w)?.entries ?? []) assert.equal(e.audio, undefined, w);
  }
});

// ---------------------------------------------------------------- Simple English Wiktionary
const SIMPLE = new URL("../../raw/simple.jsonl.gz", import.meta.url);
const haveSimple = fs.existsSync(new URL("i/manifest.json", DATA)) && fs.existsSync(SIMPLE);

test("simple wiktionary: every entry, sense, example and label is kept, in order", { skip: !haveSimple }, async () => {
  const words = ["run", "happy", "set", "dictionary"];
  const src = new Map<string, any[]>(words.map((w) => [w, []]));
  const rl = readline.createInterface({ input: fs.createReadStream(SIMPLE).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    const o = JSON.parse(line);
    if (o.lang_code === "en" && src.has(o.word) && o.senses?.some((s: any) => s.glosses?.length)) src.get(o.word)!.push(o);
  }
  for (const w of words) {
    const built = entries("simple-wiktionary", w)!;
    assert.deepEqual(
      built.map((e) => e.pos),
      src.get(w)!.map((o) => o.pos),
      w,
    );
    built.forEach((e, i) => {
      const senses = src.get(w)![i].senses.filter((s: any) => s.glosses?.length);
      assert.deepEqual(
        e.senses.map((s) => s.gloss),
        senses.map((s: any) => s.glosses.at(-1)),
        `${w} ${e.pos}: glosses`,
      );
      assert.deepEqual(
        e.senses.map((s) => (s.examples ?? []).map((x) => x.text)),
        senses.map((s: any) => (s.examples ?? []).filter((x: any) => x.text).map((x: any) => x.text)),
        `${w} ${e.pos}: examples`,
      );
      // the edition's own labels ("countable", "transitive & intransitive") are kept verbatim
      senses.forEach((s: any, j: number) => {
        for (const t of s.raw_tags ?? []) assert.ok(e.senses[j].tags?.includes(t), `${w} ${e.pos} ${j}: ${t}`);
      });
    });
  }
});

// ---------------------------------------------------------------- registry and data agree
test("every registered dictionary has data, and every data directory is registered", { skip: !haveData }, async () => {
  const { ALL_DICTS } = await import("./dicts.ts");
  assert.deepEqual(Object.keys(SHARDS).sort(), [...ALL_DICTS].sort());
});

test("sentence pairs are stored per headword with the headword's side first", { skip: !haveData }, () => {
  const love = part("tatoeba", "love")?.pairs ?? [];
  assert.ok(love.length > 0);
  for (const p of love) assert.equal(p.lang, "en");
  const sarang = part("tatoeba", "사랑")?.pairs ?? [];
  for (const p of sarang) assert.equal(p.lang, "ko");
});
