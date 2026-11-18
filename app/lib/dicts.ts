// UI languages and dictionaries: plain data and parsers with no React/browser imports, so the data
// layer, the inline preload script and Node tests can all use them.
import { DICT, type DictId } from "./keys.ts";

export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** License deeds, linked wherever a license is named (CC licenses require the license's URI). */
export const LICENSE_URL: Record<string, string> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY-SA 2.0 KR": "https://creativecommons.org/licenses/by-sa/2.0/kr/",
  "CC BY 2.0 FR": "https://creativecommons.org/licenses/by/2.0/fr/",
};

export const DICTIONARIES: { id: DictId; slug: string; short: string; source: string; license: string; url: string }[] = [
  { id: "wn", slug: "wordnet", short: "WN", source: "Open English WordNet 2025", license: "CC BY 4.0", url: "https://en-word.net/" },
  { id: "en", slug: "wiktionary", short: "WK", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0", url: "https://kaikki.org/dictionary/English/" },
  { id: "kwen", slug: "en-ko-kowiktionary", short: "EN→KO·KW", source: "한국어 위키낱말사전 · kaikki.org", license: "CC BY-SA 4.0", url: "https://kaikki.org/kowiktionary/" },
  { id: "enko", slug: "en-ko", short: "EN→KO", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0", url: "https://kaikki.org/dictionary/English/" },
  { id: "kr", slug: "krdict", short: "KRD", source: "한국어기초사전 · 국립국어원", license: "CC BY-SA 2.0 KR", url: "https://krdict.korean.go.kr/" },
  { id: "ko", slug: "ko-en", short: "KO→EN", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0", url: "https://kaikki.org/dictionary/Korean/" },
];
export const ALL_DICTS: DictId[] = DICTIONARIES.map((d) => d.id);
const bySlug = new Map(DICTIONARIES.map((d) => [d.slug, d.id]));
export const slugOf = new Map(DICTIONARIES.map((d) => [d.id, d.slug]));

/**
 * Selected dictionaries in the order the URL lists them (that is also the order the word page shows
 * them in). null (param absent) means every dictionary, in the default order. Unknown slugs and
 * duplicates are ignored.
 */
export function parseDicts(value: string | null): DictId[] {
  if (value === null) return ALL_DICTS;
  const out: DictId[] = [];
  for (const s of value.split(",")) {
    const id = bySlug.get(s.trim());
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export const dictMask = (ids: DictId[]) => ids.reduce((m, d) => m | DICT[d], 0);
