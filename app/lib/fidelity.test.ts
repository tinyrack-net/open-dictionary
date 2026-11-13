// The converters must copy sources faithfully (see the rules in types.ts). These checks compare the
// built data (data/site) with the raw source (raw/en.jsonl.gz) for real headwords, so they fail if a
// converter merges, drops, reorders, truncates or invents anything. Skipped without the data.
import assert from "node:assert/strict";
import fs from "node:fs";
import readline from "node:readline";
import { test } from "node:test";
import zlib from "node:zlib";
import { type ChunkId, entryKey, SHARDS, shardOf } from "./keys.ts";
import { TAG_KO } from "./tags.ko.ts";
import type { DictData, DictEntry } from "./types.ts";

const DATA = new URL("../../data/site/", import.meta.url);
const RAW = new URL("../../raw/en.jsonl.gz", import.meta.url);
const haveData = fs.existsSync(new URL("i/manifest.json", DATA)) && fs.existsSync(RAW);

function part<D extends ChunkId>(id: D, word: string): DictData[D] | undefined {
  const key = entryKey(word);
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
    const built = part("en", w)!;
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
  const built = part("en", "do")!;
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
    const built = part("en", w)!;
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
    const built = part("en", w)!;
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
  const senses = part("en", "ran")!.flatMap((e) => e.senses);
  const runSense = senses.find((s) => s.formOf?.includes("run"));
  assert.ok(runSense, "ran has a sense that is a form of run");
  assert.match(runSense!.gloss, /run/);
});

test("built data has no fields the format doesn't define (no summaries, ratings, merged lists)", { skip: !haveData }, () => {
  const allowed = {
    entry: new Set(["word", "pos", "etym", "alt", "pron", "audio", "forms", "tables", "etymology", "senses", "relations"]),
    sense: new Set(["gloss", "parent", "tags", "formOf", "examples", "translations", "relations"]),
  };
  for (const w of [...WORDS, "사랑", "먹다"])
    for (const id of ["wn", "en", "enko"] as const)
      for (const e of part(id, w) ?? []) {
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
