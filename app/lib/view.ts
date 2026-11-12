// Turns the raw per-dictionary entry into the compact bilingual view shown on the word page:
//
//   head          pronunciation, romanization/hanja
//   translations  Korean words for an English headword (or English words for a Korean one), by part of speech
//   meanings      one line per sense, merged across dictionaries: WordNet first (short, curated),
//                 Wiktionary for parts of speech WordNet doesn't cover; each line keeps its details
//                 (examples, synonyms, tags) for the expanded row
//   formOf        "ran" -> "run": headwords that are only inflections point to their base word
//   examples      short sentences pulled from the senses
//
// Pure function: no React, so it is easy to test and reason about.
import type { DictId } from "./keys";
import type { Entry, WiktEntry } from "./types";

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

export interface WordView {
  word: string;
  korean: boolean;
  pron?: { value: string; tag?: string }[];
  roman?: string;
  hanja?: string;
  /** Translations into the other language, grouped by part of speech. */
  translations: PosGroup<Translation>[];
  /** Base words when this headword is (mostly) an inflected form. */
  formOf: { word: string; label: string }[];
  /** Main meanings (English definitions), grouped by part of speech. */
  meanings: PosGroup<Line>[];
  /** Less common uses: proper nouns, obsolete or rare senses, extra etymologies. */
  more: PosGroup<Line>[];
  examples: { text: string; sub?: string[] }[];
  etymology?: string;
  sources: DictId[];
}

const POS_ORDER = ["noun", "verb", "adj", "adjective", "adv", "adverb", "pron", "prep", "conj", "intj", "det", "num", "particle", "phrase", "name"];
const posRank = (p: string) => {
  const i = POS_ORDER.indexOf(p);
  return i === -1 ? POS_ORDER.length : i;
};
const normPos = (p: string) => (p === "adjective" ? "adj" : p === "adverb" ? "adv" : p);

/** Tags that are grammar noise in a compact list. */
const QUIET_TAGS = new Set(["countable", "uncountable", "transitive", "intransitive", "usually", "sometimes", "stative", "ambitransitive"]);
/** Senses with these tags go to "more". */
const RARE_TAGS = new Set(["obsolete", "archaic", "rare", "dated", "historical", "nonstandard", "dialectal", "slang", "vulgar", "euphemistic", "Internet", "ironic"]);

function group<T>(items: { pos: string; item: T }[]): PosGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const { pos, item } of items) {
    const p = normPos(pos);
    map.set(p, [...(map.get(p) ?? []), item]);
  }
  return [...map].sort((a, b) => posRank(a[0]) - posRank(b[0])).map(([pos, items]) => ({ pos, items }));
}

const isShortSentence = (t: string) => t.length >= 6 && t.length <= 100 && !/\b(1[0-9]{3}|20[0-9]{2}),/.test(t);

/** "simple past of run", "plural of cat": the sense only says which word this is a form of. */
const INFLECTION = /^(?:(?:simple |present |past |third-person |singular |plural |comparative |superlative |participle |gerund |indicative |infinitive )+(?:form )?of|(?:present|past) participle of|plural of|inflection of)\b/i;

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

export function buildView(entry: Entry): WordView {
  const korean = /[\uac00-\ud7af]/.test(entry.w);
  const meanings: { pos: string; item: Line }[] = [];
  const more: { pos: string; item: Line }[] = [];
  const sources: DictId[] = [];

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

  // --- mostly an inflection ("ran", "cats") without its own WordNet entry: the base word is the
  // answer, so the Wiktionary leftovers (rare nouns, initialisms) move under "more"
  const inflected = (entry.en ?? []).some((e) => e.senses.some((s) => s.of && INFLECTION.test(s.g)));
  if (inflected && !entry.wn) more.unshift(...meanings.splice(0));

  // --- Korean headword: English definitions of the Korean word are its "meanings"
  if (entry.ko) {
    sources.push("ko");
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

  // --- inflections: "ran" -> run
  const formOf = new Map<string, string>();
  for (const e of [...(entry.en ?? []), ...(entry.ko ?? [])])
    for (const s of e.senses) {
      // one link per base word regardless of case (cat / Cat / CAT -> cat)
      if (!s.of || !INFLECTION.test(s.g) || [...formOf.keys()].some((k) => k.toLowerCase() === s.of!.toLowerCase())) continue;
      if (s.of.toLowerCase() === entry.w.toLowerCase()) continue;
      // "simple past of run" -> label "simple past"
      formOf.set(s.of, s.g.replace(/\s+of\b.*$/i, "").trim());
    }

  // --- examples: short sentences, deduplicated
  const exSeen = new Set<string>();
  const examples: { text: string; sub?: string[] }[] = [];
  // only from main meanings: rare, slang and vulgar senses stay behind "more meanings"
  for (const { item } of meanings)
    for (const x of item.examples ?? [])
      if (isShortSentence(x.text) && !exSeen.has(x.text)) {
        exSeen.add(x.text);
        examples.push(x);
      }

  // --- head
  // pronunciation: one US and one UK form when available, phonemic /.../ over phonetic [...]
  const wnPron = entry.wn?.flatMap((w) => w.pron ?? []) ?? [];
  const candidates = [
    ...wnPron.map((p) => ({ value: `/${p.v}/`, tag: p.var })),
    ...(entry.en ?? []).flatMap((e) => e.ipa ?? []).map((p) => ({ value: p.v, tag: p.tags?.[0] })),
    ...(entry.ko?.[0]?.ipa ?? []).map((p) => ({ value: p.v, tag: undefined })),
  ];
  const region = (tag?: string) =>
    tag === "US" || tag === "General-American" ? "US" : tag === "GB" || tag === "UK" || tag === "Received-Pronunciation" ? "UK" : undefined;
  const seenPron = new Set<string>();
  const pron: { value: string; tag?: string }[] = [];
  for (const want of ["US", "UK"])
    for (const c of candidates)
      if (region(c.tag) === want && c.value.startsWith("/") && !seenPron.has(want)) {
        seenPron.add(want);
        pron.push({ value: c.value, tag: want });
      }
  if (!pron.length && candidates[0]) pron.push({ value: candidates[0].value });
  const ko0 = entry.ko?.[0];

  return {
    word: entry.w,
    korean,
    ...(pron.length ? { pron } : {}),
    ...(ko0?.roman ? { roman: ko0.roman } : {}),
    ...(ko0?.hanja ? { hanja: ko0.hanja } : {}),
    translations: group(translations),
    formOf: [...formOf].map(([word, label]) => ({ word, label })),
    meanings: group(meanings),
    more: group(more),
    examples: examples.slice(0, 6),
    ...(entry.en?.find((e) => e.ety)?.ety || ko0?.ety ? { etymology: entry.en?.find((e) => e.ety)?.ety ?? ko0?.ety } : {}),
    sources,
  };
}
