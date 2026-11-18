// The registry: every dictionary the site shows, and the UI languages. Plain data and pure helpers
// (no React, no browser APIs), shared by the app, the inline preload script, the data pipeline
// (scripts/) and Node tests.
//
// Adding a dictionary = one entry here + one source module in scripts/sources/ that converts its raw
// data. Nothing else names dictionaries: the word page, settings, search, about page, data loading
// and chunk layout are all driven by this list.
import type { DictPart, IndexRow } from "./types.ts";

// ---------------------------------------------------------------- UI languages

/** Interface languages: the first path segment (/en/…, /ko/…). Each has a file in app/locales/. */
export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** Text in several UI languages; English is required and is the fallback. */
export type Localized = { en: string } & Partial<Record<Lang, string>>;
export const localized = (v: Localized, lang: Lang) => v[lang] ?? v.en;

// ---------------------------------------------------------------- dictionaries

export interface Dictionary {
  /** Stable id: the ?dicts= value, the data directory (d/<id>/) and the key in loaded entries. */
  id: string;
  /** "dictionary": entries and backlinks; "sentences": example sentence pairs. */
  kind: "dictionary" | "sentences";
  /** Language of the headwords (BCP 47). */
  headLang: string;
  /** Language the definitions are written in. */
  glossLang: string;
  name: Localized;
  /** What the dictionary contains, for the about page. */
  description: Localized;
  /** Badge in search suggestions. */
  short: string;
  source: {
    /** shown on every card, with a link to `url` */
    name: string;
    url: string;
    /** short name for the site description ("Wiktionary") */
    credit: string;
  };
  /** SPDX-style name; LICENSE_URL links it. */
  license: string;
  /** Search ranking: how much a headword in this dictionary is preferred (0 = none). */
  searchBoost?: number;
}

/** In display order: the word page shows selected dictionaries in this order by default. */
export const DICTIONARIES: Dictionary[] = [
  {
    id: "simple-wiktionary",
    kind: "dictionary",
    headLang: "en",
    glossLang: "en",
    name: { en: "English (Simple English Wiktionary)", ko: "영영 (쉬운 영어 위키낱말사전)" },
    description: {
      en: "Learner's definitions of English words in plain English, with examples, labels such as countable or transitive, synonyms and antonyms.",
      ko: "학습자를 위해 쉬운 영어 문장으로 풀이한 영어 뜻풀이, 예문, 가산·타동 같은 문법 표시, 유의어와 반의어.",
    },
    short: "SW",
    source: { name: "Simple English Wiktionary · kaikki.org", url: "https://kaikki.org/simplewiktionary/English/", credit: "Simple English Wiktionary" },
    license: "CC BY-SA 4.0",
    searchBoost: 10,
  },
  {
    id: "wordnet",
    kind: "dictionary",
    headLang: "en",
    glossLang: "en",
    name: { en: "English (WordNet)", ko: "영영 (WordNet)" },
    description: { en: "English definitions, examples, synonyms and broader terms.", ko: "영어 뜻풀이, 예문, 유의어, 상위어." },
    short: "WN",
    source: { name: "Open English WordNet 2025", url: "https://en-word.net/", credit: "WordNet" },
    license: "CC BY 4.0",
    searchBoost: 20,
  },
  {
    id: "wiktionary",
    kind: "dictionary",
    headLang: "en",
    glossLang: "en",
    name: { en: "English (Wiktionary)", ko: "영영 (위키낱말사전)" },
    description: {
      en: "English entries: senses, examples, pronunciations, recordings, forms and etymology.",
      ko: "영어 표제어의 뜻, 예문, 발음, 녹음, 변화형, 어원.",
    },
    short: "WK",
    source: { name: "English Wiktionary · kaikki.org", url: "https://kaikki.org/dictionary/English/", credit: "Wiktionary" },
    license: "CC BY-SA 4.0",
  },
  {
    id: "en-ko-kowiktionary",
    kind: "dictionary",
    headLang: "en",
    glossLang: "ko",
    name: { en: "English → Korean (Korean Wiktionary)", ko: "영한 (한국어 위키낱말사전)" },
    description: {
      en: "English entries defined in Korean, with examples translated into Korean, pronunciations and recordings.",
      ko: "한국어로 뜻을 풀이한 영어 표제어, 한국어 번역이 붙은 예문, 발음과 녹음.",
    },
    short: "EN→KO·KW",
    source: { name: "한국어 위키낱말사전 · kaikki.org", url: "https://kaikki.org/kowiktionary/", credit: "Wiktionary" },
    license: "CC BY-SA 4.0",
    searchBoost: 5,
  },
  {
    id: "en-ko",
    kind: "dictionary",
    headLang: "en",
    glossLang: "ko",
    name: { en: "English → Korean", ko: "영한 (영어 위키낱말사전)" },
    description: { en: "Korean translations of English entries, by sense.", ko: "영어 표제어의 뜻별 한국어 번역." },
    short: "EN→KO",
    source: { name: "English Wiktionary · kaikki.org", url: "https://kaikki.org/dictionary/English/", credit: "Wiktionary" },
    license: "CC BY-SA 4.0",
    searchBoost: 5,
  },
  {
    id: "krdict",
    kind: "dictionary",
    headLang: "ko",
    glossLang: "ko",
    name: { en: "Korean (Basic Korean Dictionary)", ko: "한국어 (한국어기초사전)" },
    description: {
      en: "Korean entries with Korean definitions, an English equivalent and English definition for each sense, written pronunciation, conjugations, hanja, example phrases and dialogues, and related words. English words list the Korean words that have them as an equivalent. Text only: the site's recordings and images are licensed per file and are not used.",
      ko: "한국어 표제어의 뜻풀이, 뜻마다 영어 대응어와 영어 뜻풀이, 발음 표기, 활용, 한자, 예문과 대화 예문, 관련어. 영어 단어에는 그 단어를 대응어로 가진 한국어 단어를 보여 줍니다. 텍스트만 사용하며, 파일별로 라이선스가 다른 녹음·이미지는 쓰지 않습니다.",
    },
    short: "KRD",
    source: { name: "한국어기초사전 © 국립국어원", url: "https://krdict.korean.go.kr/", credit: "한국어기초사전" },
    license: "CC BY-SA 2.0 KR",
    searchBoost: 15,
  },
  {
    id: "ko-en",
    kind: "dictionary",
    headLang: "ko",
    glossLang: "en",
    name: { en: "Korean → English", ko: "한영 (영어 위키낱말사전)" },
    description: {
      en: "Korean entries explained in English, with romanization, hanja and examples. Korean words also list the English entries that give them as a translation.",
      ko: "영어로 설명한 한국어 표제어, 로마자 표기, 한자, 예문. 한국어 단어에는 그 단어를 번역어로 가진 영어 표제어도 보여 줍니다.",
    },
    short: "KO→EN",
    source: { name: "English Wiktionary · kaikki.org", url: "https://kaikki.org/dictionary/Korean/", credit: "Wiktionary" },
    license: "CC BY-SA 4.0",
    searchBoost: 15,
  },
  {
    id: "tatoeba",
    kind: "sentences",
    headLang: "en",
    glossLang: "ko",
    name: { en: "Example sentences (Tatoeba)", ko: "예문 (Tatoeba)" },
    description: {
      en: "English–Korean sentence pairs, shown under the words they contain exactly.",
      ko: "영어–한국어 예문 쌍. 단어가 정확히 들어 있는 문장만 보여 줍니다.",
    },
    short: "EX",
    source: { name: "Tatoeba", url: "https://tatoeba.org/", credit: "Tatoeba" },
    license: "CC BY 2.0 FR",
  },
];

/** Data used without being a dictionary of its own, credited on the about page. */
export const EXTRA_SOURCES: { name: string; url: string; license: string; licenseUrl?: string; description: Localized }[] = [
  {
    name: "wordfreq 3.1 (Robyn Speer)",
    url: "https://github.com/rspeer/wordfreq",
    license: "CC BY-SA 4.0",
    description: { en: "Word frequency, used only to order search suggestions.", ko: "단어 빈도. 검색 추천 순서에만 사용합니다." },
  },
  {
    name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/",
    license: "CC BY-SA / CC BY / CC0",
    licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
    description: {
      en: "Recorded pronunciations linked from Wiktionary and played from Wikimedia Commons. Each recording has its own author and free license, listed on its Commons page.",
      ko: "위키낱말사전에 연결된 녹음 발음을 위키미디어 공용에서 재생합니다. 녹음마다 저작자와 자유 라이선스가 공용 페이지에 표시됩니다.",
    },
  },
];

/** License deeds, linked wherever a license is named (CC licenses require the license's URI). */
export const LICENSE_URL: Record<string, string> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY-SA 2.0 KR": "https://creativecommons.org/licenses/by-sa/2.0/kr/",
  "CC BY 2.0 FR": "https://creativecommons.org/licenses/by/2.0/fr/",
};

/** Words linked from the home page before anything has been looked up. */
export const SAMPLE_WORDS = ["serendipity", "dictionary", "run", "사랑", "먹다", "사전"];

export type DictId = string;

/** Headword languages across all dictionaries, in registry order ("en", "ko"): what search covers. */
export const headLanguages = (): string[] => [...new Set(DICTIONARIES.flatMap((d) => [d.headLang, d.glossLang]))];

/** Short names of the sources, for the site description ("WordNet, Wiktionary, …"). */
export const sourceCredits = (): string[] => [...new Set(DICTIONARIES.map((d) => d.source.credit))];
export const ALL_DICTS: DictId[] = DICTIONARIES.map((d) => d.id);
export const dictById = new Map(DICTIONARIES.map((d) => [d.id, d]));

/**
 * Selected dictionaries in the order the URL lists them (that is also the order the word page shows
 * them in). null (param absent) means every dictionary, in the default order. Unknown ids and
 * duplicates are ignored.
 */
export function parseDicts(value: string | null): DictId[] {
  if (value === null) return ALL_DICTS;
  const out: DictId[] = [];
  for (const s of value.split(",")) {
    const id = s.trim();
    if (dictById.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------- dictionary sets as numbers

// The search index stores which dictionaries have a headword as one number: bit i = DICTIONARIES[i].
// Arithmetic instead of bitwise operators, so up to 53 dictionaries fit (bitwise stops at 31).
if (DICTIONARIES.length > 53) throw new Error("dicts.ts: at most 53 dictionaries fit in an index mask");
const BIT = new Map(DICTIONARIES.map((d, i) => [d.id, 2 ** i]));

export const dictMask = (ids: Iterable<DictId>): number => {
  let m = 0;
  for (const id of new Set(ids)) m += BIT.get(id) ?? 0;
  return m;
};
export const maskHas = (mask: number, id: DictId): boolean => {
  const bit = BIT.get(id);
  return bit !== undefined && Math.floor(mask / bit) % 2 === 1;
};
export const maskIds = (mask: number): DictId[] => ALL_DICTS.filter((id) => maskHas(mask, id));
export const maskOverlaps = (a: number, b: number): boolean => ALL_DICTS.some((id) => maskHas(a, id) && maskHas(b, id));

/**
 * Ranking for prefix matches: lower is better. Common, short, plain words first; a word gets the
 * largest boost of the dictionaries that have it, plus a little for each further dictionary.
 */
export function rankScore([w, m, f]: [string, number, number?]): number {
  let s = Array.from(w).length;
  // Zipf x10: "love" 58 -> -29, a rare word 25 -> -12
  if (f) s -= f / 2;
  const ids = maskIds(m);
  if (ids.length) s -= Math.max(...ids.map((id) => dictById.get(id)!.searchBoost ?? 0)) + (ids.length - 1) * 2;
  if (/[^\p{L}]/u.test(w)) s += 10;
  if (/\p{Lu}/u.test(w)) s += 3;
  return s;
}
export type { IndexRow };

/**
 * Language of a headword, from what the dictionaries hold for it: the headword language of the first
 * dictionary with entries for it; otherwise the definition language of one that only links to it
 * (a backlink sits on a word of the dictionary's definition language).
 */
export function headwordLang(parts: Record<string, DictPart | undefined>): string | undefined {
  for (const d of DICTIONARIES) if (d.kind === "dictionary" && parts[d.id]?.entries?.length) return d.headLang;
  for (const d of DICTIONARIES) if (d.kind === "dictionary" && parts[d.id]?.backlinks?.length) return d.glossLang;
  for (const d of DICTIONARIES) {
    const pair = parts[d.id]?.pairs?.[0];
    if (pair) return pair.lang;
  }
  return undefined;
}
