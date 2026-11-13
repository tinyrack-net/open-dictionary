// UI languages and dictionaries: plain data and parsers with no React/browser imports, so the data
// layer, the inline preload script and Node tests can all use them.
import { DICT, type DictId } from "./keys.ts";

export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

export const DICTIONARIES: { id: DictId; slug: string; short: string; source: string; license: string }[] = [
  { id: "wn", slug: "wordnet", short: "WN", source: "Open English WordNet 2025", license: "CC BY 4.0" },
  { id: "en", slug: "wiktionary", short: "WK", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0" },
  { id: "enko", slug: "en-ko", short: "EN→KO", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0" },
  { id: "ko", slug: "ko-en", short: "KO→EN", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0" },
];
export const ALL_DICTS: DictId[] = DICTIONARIES.map((d) => d.id);
const bySlug = new Map(DICTIONARIES.map((d) => [d.slug, d.id]));
export const slugOf = new Map(DICTIONARIES.map((d) => [d.id, d.slug]));

/** null (param absent) means every dictionary. */
export function parseDicts(value: string | null): DictId[] {
  if (value === null) return ALL_DICTS;
  const picked = new Set(value.split(",").map((s) => bySlug.get(s.trim())));
  return ALL_DICTS.filter((d) => picked.has(d));
}

export const dictMask = (ids: DictId[]) => ids.reduce((m, d) => m | DICT[d], 0);
