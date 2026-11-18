// UI strings for each interface language (the first path segment, /en/…, /ko/…). One file per
// language in app/locales/; dictionary names and descriptions come from the registry (dicts.ts).
// Dictionary content (glosses, tags, parts of speech) is never rewritten: a locale may map source
// tags and parts of speech 1:1 to its own labels, and anything missing is shown as the source wrote it.
import { useParams } from "react-router";
import en, { type Strings } from "../locales/en.ts";
import ko from "../locales/ko.ts";
import { DEFAULT_LANG, isLang, type Lang } from "./dicts.ts";

export type { Strings };

export const STRINGS: Record<Lang, Strings> = { en, ko };

/** Strings for a route's `lang` param (meta functions, error boundaries). */
export const stringsFor = (lang: string | undefined): Strings => STRINGS[isLang(lang) ? lang : DEFAULT_LANG];

export function useLang(): Lang {
  const { lang } = useParams();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

export function useT() {
  return STRINGS[useLang()];
}

/** Part of speech in the UI language; the source's own label when there is no 1:1 entry. */
export function posLabel(t: Strings, pos: string) {
  return t.pos[pos] ?? pos;
}

/** Grammar/usage tag in the UI language; the source's own tag when there is no 1:1 entry. */
export function tagLabel(t: Strings, tag: string) {
  return t.tags[tag] ?? tag;
}
