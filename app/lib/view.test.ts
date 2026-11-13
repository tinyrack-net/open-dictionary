// Checks the word page's answers on real data for the benchmark words. Needs data/site (pnpm build-data).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { type ChunkId, DICT, entryKey, SHARDS, shardOf } from "./keys.ts";
import type { Entry } from "./types.ts";
import { buildView } from "./view.ts";

const DATA = new URL("../../data/site/", import.meta.url);
const haveData = fs.existsSync(new URL("i/manifest.json", DATA));

function load(word: string): Entry {
  const key = entryKey(word);
  const part = (id: ChunkId) => {
    const file = new URL(`d/${id}/${shardOf(key, SHARDS[id])}.json`, DATA);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8"))[key] : undefined;
  };
  const ko = part("ko");
  return { w: word, wn: part("wn"), en: part("en"), enko: part("enko"), ko: ko?.ko, koRev: ko?.rev, pairs: part("ex") };
}
void DICT;

test("run: a verb first, not a form of rin", { skip: !haveData }, () => {
  const v = buildView(load("run"));
  assert.deepEqual(v.formOf, [], "run must not point to rin");
  assert.equal(v.meanings[0].pos, "verb");
  assert.equal(v.translations[0].pos, "verb");
  assert.ok(v.forms?.some((f) => f.form === "ran" && f.label === "past"));
  assert.ok(v.summary.length <= 5);
});

test("ran: points to run", { skip: !haveData }, () => {
  const v = buildView(load("ran"));
  assert.equal(v.formOf[0]?.word, "run");
  assert.equal(v.meanings.length, 0, "leftover senses fold under more");
});

test("love: Korean summary across parts of speech, US/UK audio, bilingual examples", { skip: !haveData }, () => {
  const v = buildView(load("love"));
  assert.ok(v.summary.includes("사랑") && v.summary.includes("사랑하다"), v.summary.join(","));
  assert.deepEqual(v.audio?.map((a) => a.tag), ["US", "UK"]);
  assert.ok(v.examples[0].sub?.[0] && /[\uac00-\ud7af]/.test(v.examples[0].sub[0]), "first example has a Korean translation");
  assert.equal(v.formOf.length, 0);
});

test("사랑: two homographs (love, 舍廊) and related words", { skip: !haveData }, () => {
  const v = buildView(load("사랑"));
  assert.equal(v.homographs?.length, 2);
  assert.equal(v.homographs?.[1].hanja, "舍廊");
  assert.ok(v.related.some((r) => r.word === "사랑하다"));
  assert.ok(v.translations.length > 0);
});

test("give up: phrase with forms and examples", { skip: !haveData }, () => {
  const v = buildView(load("give up"));
  assert.ok(v.forms?.some((f) => f.form === "gave up"));
  assert.ok(v.examples.length > 0);
});
