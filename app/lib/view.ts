// Turns the raw per-dictionary entry into the word page, answer first:
//
//   head          headword, US/UK pronunciation + recordings, frequency stars, word forms (runs, ran, …)
//   summary       the top translations as one numbered line ("1. 사랑 2. 애정 3. 연인"), like Daum/Naver
//   translations  every translation, by part of speech (top 5 per part of speech, rest on demand)
//   formOf        "ran" -> run: only when the word has no meaning of its own worth showing
//   homographs    Korean words with the same spelling but different origin (사랑 love / 사랑 舍廊)
//   meanings      English definitions, one line per sense: WordNet first (short, curated), Wiktionary
//                 for gaps; rare senses (names, archaic, slang…) fold under "more"
//   examples      bilingual sentence pairs (Tatoeba) first, then short dictionary examples
//   related       derived words (사랑하다, 사랑니; give up, give in)
//
// Parts of speech follow the source order (Wiktionary lists the most common first), not a fixed
// noun-before-verb order: "run" is first of all a verb.
//
// Pure function: no React, so it is unit-tested in view.test.ts.
import type { DictId } from "./keys.ts";
import type { Audio, Entry, WiktEntry } from "./types.ts";

export type Pos = string;

export interface Line {
  text: string;
  source: DictId;
  tags?: string[];
  examples?: { text: string; sub?: string[] }[];
  synonyms?: string[];
  broader?: string[];
}

export interface PosGroup<T> {
  pos: Pos;
  items: T[];
}

export interface Translation {
  word: string;
  note?: string; // romanization / hanja
}

export interface Homograph {
  /** 1-based number shown next to the headword (사랑¹, 사랑²) */
  n: number;
  hanja?: string;
  meanings: PosGroup<Line>[];
}

export interface WordView {
  word: string;
  korean: boolean;
  pron?: { value: string; tag?: string }[];
  audio?: Audio[];
  roman?: string;
  hanja?: string;
  /** 1–3 stars from word frequency; undefined when unknown or rare */
  stars?: 1 | 2 | 3;
  /** inflected forms: "runs", "ran", "running" (with grammar labels) */
  forms?: { form: string; label: string }[];
  /** top translations across parts of speech, for the summary line */
  summary: string[];
  translations: PosGroup<Translation>[];
  formOf: { word: string; label: string }[];
  /** set when the Korean headword has several unrelated meanings (사랑 love / 사랑 舍廊) */
  homographs?: Homograph[];
  meanings: PosGroup<Line>[];
  more: PosGroup<Line>[];
  examples: { text: string; sub?: string[] }[];
  related: { word: string; note?: string }[];
  etymology?: string;
  sources: DictId[];
}

const normPos = (p: string) => (p === "adjective" ? "adj" : p === "adverb" ? "adv" : p);

/** Tags that are grammar noise in a compact list. */
const QUIET_TAGS = new Set(["countable", "uncountable", "transitive", "intransitive", "usually", "sometimes", "stative", "ambitransitive", "ergative"]);
/** Senses with these tags go to "more". */
const RARE_TAGS = new Set([
  "obsolete", "archaic", "rare", "dated", "historical", "nonstandard", "dialectal", "slang", "vulgar",
  "euphemistic", "Internet", "ironic", "colloquial", "derogatory", "offensive", "humorous", "informal",
]);

/** Groups by part of speech, keeping the order in which each part of speech first appears. */
function group<T>(items: { pos: string; item: T }[]): PosGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const { pos, item } of items) {
    const p = normPos(pos);
    map.set(p, [...(map.get(p) ?? []), item]);
  }
  return [...map].map(([pos, items]) => ({ pos, items }));
}

const isShortSentence = (t: string) => t.length >= 6 && t.length <= 100 && !/\b(1[0-9]{3}|20[0-9]{2}),/.test(t);

/** "simple past of run", "plural of cat": the sense only says which word this is a form of. */
export const INFLECTION =
  /^(?:(?:simple |present |past |third-person |singular |plural |comparative |superlative |participle |gerund |indicative |infinitive )+(?:form )?of|(?:present|past) participle of|plural of|inflection of)\b/i;

function wiktLines(entries: WiktEntry[], source: DictId) {
  const out: { pos: string; item: Line; rare: boolean }[] = [];
  for (const e of entries) {
    for (const s of e.senses) {
      if (s.of && INFLECTION.test(s.g)) continue; // shown as formOf
      const tags = s.tags?.filter((t) => !QUIET_TAGS.has(t));
      const rare = e.pos === "name" || !!s.tags?.some((t) => RARE_TAGS.has(t));
      out.push({
        pos: e.pos,
        rare,
        item: {
          text: s.g,
          source,
          ...(tags?.length ? { tags } : {}),
          ...(s.ex?.length ? { examples: s.ex.map((x) => ({ text: x.t, sub: [x.roman, x.en].filter(Boolean) as string[] })) } : {}),
          ...(s.syn?.length ? { synonyms: s.syn } : {}),
        },
      });
    }
  }
  return out;
}

/** Zipf frequency -> stars: ≥5 very common (love, run), ≥4 common, ≥3.3 occasional. */
export function starsFor(freq?: number): 1 | 2 | 3 | undefined {
  if (!freq) return undefined;
  return freq >= 5 ? 3 : freq >= 4 ? 2 : freq >= 3.3 ? 1 : undefined;
}

/** Short grammar label for an inflected form, e.g. ["past","participle"] -> "past participle". */
function formLabel(tags: string[] = []): string {
  const t = new Set(tags);
  if (t.has("plural")) return "plural";
  if (t.has("third-person")) return "3rd person";
  if (t.has("participle") && t.has("present")) return "-ing";
  if (t.has("participle") && t.has("past")) return "past participle";
  if (t.has("past")) return "past";
  if (t.has("comparative")) return "comparative";
  if (t.has("superlative")) return "superlative";
  return tags.filter((x) => !["singular", "indicative"].includes(x)).join(" ");
}

export function buildView(entry: Entry): WordView {
  const korean = /[\uac00-\ud7af]/.test(entry.w);
  const meanings: { pos: string; item: Line }[] = [];
  const more: { pos: string; item: Line }[] = [];
  const sources: DictId[] = [];

  // Source order of parts of speech: Wiktionary first (it lists the main use first), then WordNet.
  const posOrder: string[] = [];
  for (const e of [...(entry.en ?? []), ...(entry.wn ?? [])]) if (!posOrder.includes(normPos(e.pos))) posOrder.push(normPos(e.pos));
  const byPosOrder = <T,>(groups: PosGroup<T>[]) =>
    [...groups].sort((a, b) => {
      const ia = posOrder.indexOf(a.pos);
      const ib = posOrder.indexOf(b.pos);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  // --- meanings: WordNet first
  const wnPos = new Set<string>();
  for (const e of entry.wn ?? []) {
    wnPos.add(normPos(e.pos));
    for (const s of e.senses) {
      meanings.push({
        pos: e.pos,
        item: {
          text: s.def,
          source: "wn",
          ...(s.ex?.length ? { examples: s.ex.map((t) => ({ text: t })) } : {}),
          ...(s.syn?.length ? { synonyms: s.syn } : {}),
          ...(s.broader?.length ? { broader: s.broader } : {}),
        },
      });
    }
  }
  if (entry.wn) sources.push("wn");

  // --- meanings: Wiktionary (English) for what WordNet lacks; the rest goes to "more".
  // When WordNet covers a part of speech with only one or two senses, Wiktionary's top senses are
  // kept alongside so short entries ("serendipity") still read well.
  if (entry.en) {
    sources.push("en");
    const wnCount = new Map<string, number>();
    for (const m of meanings) wnCount.set(normPos(m.pos), (wnCount.get(normPos(m.pos)) ?? 0) + 1);
    const added = new Map<string, number>();
    for (const l of wiktLines(entry.en, "en")) {
      const p = normPos(l.pos);
      const covered = (wnCount.get(p) ?? 0) + (added.get(p) ?? 0) >= 3 && wnPos.has(p);
      if (l.rare || covered || (added.get(p) ?? 0) >= 8) more.push(l);
      else {
        meanings.push(l);
        added.set(p, (added.get(p) ?? 0) + 1);
      }
    }
  }

  // --- inflections: "ran" -> run. Only the answer when the word has nothing better of its own:
  // "run" is listed as a past form of the rare "rin", but run has WordNet senses and is far more
  // common, so it must not point to rin.
  const formOfAll = new Map<string, string>();
  for (const e of [...(entry.en ?? []), ...(entry.ko ?? [])])
    for (const s of e.senses) {
      if (!s.of || !INFLECTION.test(s.g) || [...formOfAll.keys()].some((k) => k.toLowerCase() === s.of!.toLowerCase())) continue;
      if (s.of.toLowerCase() === entry.w.toLowerCase()) continue;
      formOfAll.set(s.of, s.g.replace(/\s+of\b.*$/i, "").trim()); // "simple past of run" -> "simple past"
    }
  const isMainlyInflection = formOfAll.size > 0 && !entry.wn && meanings.length <= 2;
  // the first base word only: Wiktionary lists the main one first (ran -> run, not the rare rin)
  const formOf = isMainlyInflection ? [...formOfAll].slice(0, 1).map(([word, label]) => ({ word, label })) : [];
  // the inflection is the answer: the word's own leftovers (rare nouns, initialisms) fold away
  if (isMainlyInflection) more.unshift(...meanings.splice(0));

  // --- Korean headword: English definitions are its meanings; split by origin when there are
  // several (사랑 "love" vs 사랑 舍廊 "salon")
  let homographs: Homograph[] | undefined;
  if (entry.ko) {
    sources.push("ko");
    const etyms = [...new Set(entry.ko.map((e) => e.etym ?? 0))];
    if (etyms.length > 1) {
      homographs = etyms.map((n, i) => {
        const es = entry.ko!.filter((e) => (e.etym ?? 0) === n);
        // rare senses are dropped only when common ones remain: 사랑² 舍廊 is only "historical"
        const all = wiktLines(es, "ko");
        const lines = all.some((l) => !l.rare) ? all.filter((l) => !l.rare) : all;
        return { n: i + 1, ...(es.find((e) => e.hanja)?.hanja && { hanja: es.find((e) => e.hanja)!.hanja }), meanings: group(lines) };
      });
    }
    for (const l of wiktLines(entry.ko, "ko")) (l.rare ? more : meanings).push(l);
  }

  // --- translations into the other language
  const translations: { pos: string; item: Translation }[] = [];
  if (entry.enko) {
    sources.push("enko");
    const seen = new Set<string>();
    for (const g of entry.enko)
      for (const k of g.ko) {
        const key = g.pos + k.w;
        if (seen.has(key)) continue;
        seen.add(key);
        translations.push({ pos: g.pos, item: { word: k.w, ...(k.alt || k.roman ? { note: [k.alt, k.roman].filter(Boolean).join(" ") } : {}) } });
      }
  }
  if (entry.koRev) {
    if (!sources.includes("ko")) sources.push("ko");
    const seen = new Set<string>();
    for (const r of entry.koRev) {
      if (seen.has(r.pos + r.en)) continue;
      seen.add(r.pos + r.en);
      translations.push({ pos: r.pos, item: { word: r.en } });
    }
  }
  const translationGroups = byPosOrder(group(translations));
  // summary: round-robin across parts of speech so "love" shows 사랑 and 사랑하다, not four nouns
  const summary: string[] = [];
  for (let i = 0; summary.length < 5 && translationGroups.some((g) => g.items[i]); i++)
    for (const g of translationGroups) if (g.items[i] && summary.length < 5 && !summary.includes(g.items[i].word)) summary.push(g.items[i].word);

  // --- examples: bilingual pairs first, then short single-language examples from main meanings
  const exSeen = new Set<string>();
  const examples: { text: string; sub?: string[] }[] = [];
  for (const p of entry.pairs ?? []) {
    const [text, sub] = korean ? [p.ko, p.en] : [p.en, p.ko];
    if (!exSeen.has(text)) {
      exSeen.add(text);
      examples.push({ text, sub: [sub] });
    }
  }
  for (const { item } of meanings)
    for (const x of item.examples ?? [])
      if (isShortSentence(x.text) && !exSeen.has(x.text)) {
        exSeen.add(x.text);
        examples.push(x);
      }

  // --- head: one US and one UK pronunciation when available, phonemic /.../ over phonetic [...]
  const wnPron = entry.wn?.flatMap((w) => w.pron ?? []) ?? [];
  const candidates = [
    ...wnPron.map((p) => ({ value: `/${p.v}/`, tag: p.var })),
    ...(entry.en ?? []).flatMap((e) => e.ipa ?? []).map((p) => ({ value: p.v, tag: p.tags?.[0] })),
    ...(entry.ko?.[0]?.ipa ?? []).map((p) => ({ value: p.v, tag: undefined })),
  ];
  const region = (tag?: string) =>
    tag === "US" || tag === "General-American" ? "US" : tag === "GB" || tag === "UK" || tag === "Received-Pronunciation" ? "UK" : undefined;
  const seenPron = new Set<string>();
  let pron: { value: string; tag?: string }[] = [];
  for (const want of ["US", "UK"])
    for (const c of candidates)
      if (region(c.tag) === want && c.value.startsWith("/") && !seenPron.has(want)) {
        seenPron.add(want);
        pron.push({ value: c.value, tag: want });
      }
  // same transcription for US and UK (/ɹæn/): show it once, without an accent label
  if (pron.length === 2 && pron[0].value === pron[1].value) pron = [{ value: pron[0].value }];
  if (!pron.length && candidates[0]) pron.push({ value: candidates[0].value });

  const audio = [...(entry.en ?? []), ...(entry.ko ?? [])].find((e) => e.audio?.length)?.audio;

  // word forms across parts of speech (love: loves, loved, loving), each form once
  const forms: { form: string; label: string }[] = [];
  for (const e of entry.en ?? [])
    if (e.pos !== "name") // proper-noun entries add "Loves"
      for (const f of e.forms ?? [])
        if (!forms.some((x) => x.form.toLowerCase() === f.f.toLowerCase()) && forms.length < 6) forms.push({ form: f.f, label: formLabel(f.tags) });

  // related words: Korean derived words first (with their English gloss), then English
  const relSeen = new Set<string>([entry.w.toLowerCase()]);
  const related: { word: string; note?: string }[] = [];
  for (const e of [...(entry.ko ?? []), ...(entry.en ?? [])])
    for (const d of e.derived ?? [])
      if (!relSeen.has(d.w.toLowerCase()) && related.length < 12) {
        relSeen.add(d.w.toLowerCase());
        related.push({ word: d.w, ...(d.en && { note: d.en }) });
      }

  // Each part of speech shows its first MAIN_PER_POS meanings; the rest move to "more" (run has 41
  // WordNet verb senses: nobody reads past the first few, and Daum/Naver cap similarly).
  const MAIN_PER_POS = 6;
  const mainGroups = byPosOrder(group(meanings));
  const moreFromMain: { pos: string; item: Line }[] = [];
  for (const g of mainGroups) {
    for (const item of g.items.splice(MAIN_PER_POS)) moreFromMain.push({ pos: g.pos, item });
  }

  const ko0 = entry.ko?.[0];
  const stars = starsFor(entry.freq);
  return {
    word: entry.w,
    korean,
    ...(pron.length ? { pron } : {}),
    ...(audio ? { audio } : {}),
    ...(ko0?.roman ? { roman: ko0.roman } : {}),
    ...(ko0?.hanja && !homographs ? { hanja: ko0.hanja } : {}),
    ...(stars ? { stars } : {}),
    ...(forms.length ? { forms } : {}),
    summary,
    translations: translationGroups,
    formOf,
    ...(homographs ? { homographs } : {}),
    meanings: mainGroups,
    more: byPosOrder(group([...moreFromMain, ...more])),
    examples: examples.slice(0, 6),
    related,
    ...(entry.en?.find((e) => e.ety)?.ety || ko0?.ety ? { etymology: entry.en?.find((e) => e.ety)?.ety ?? ko0?.ety } : {}),
    sources,
  };
}
