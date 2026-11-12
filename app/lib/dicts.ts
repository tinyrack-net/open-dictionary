// Selected dictionaries live in the URL (?dicts=wordnet,en-ko) so a link reproduces exactly what was on screen.
// Word pages are /{lang}/word?word=<headword>&dicts=<slugs>; dicts is omitted when every dictionary is selected.
import { useSyncExternalStore } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import { DICT, type DictId } from "./keys";
import { useLang } from "./i18n";

export const DICTIONARIES: { id: DictId; slug: string; short: string; source: string; license: string }[] = [
  { id: "wn", slug: "wordnet", short: "WN", source: "Open English WordNet 2025", license: "CC BY 4.0" },
  { id: "en", slug: "wiktionary", short: "WK", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0" },
  { id: "enko", slug: "en-ko", short: "EN→KO", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0" },
  { id: "ko", slug: "ko-en", short: "KO→EN", source: "English Wiktionary · kaikki.org", license: "CC BY-SA 4.0" },
];
export const ALL_DICTS: DictId[] = DICTIONARIES.map((d) => d.id);

const bySlug = new Map(DICTIONARIES.map((d) => [d.slug, d.id]));
const slugOf = new Map(DICTIONARIES.map((d) => [d.id, d.slug]));

/** null (param absent) means every dictionary. */
export function parseDicts(value: string | null): DictId[] {
  if (value === null) return ALL_DICTS;
  const picked = new Set(value.split(",").map((s) => bySlug.get(s.trim())));
  return ALL_DICTS.filter((d) => picked.has(d));
}

/** Value of the dicts param, or null when every dictionary is selected (param omitted). */
export function dictsParam(ids: DictId[]): string | null {
  if (ids.length === ALL_DICTS.length) return null;
  return ids.map((d) => slugOf.get(d)).join(",");
}

export function dictsQuery(ids: DictId[]): string {
  const v = dictsParam(ids);
  return v === null ? "" : `?dicts=${v}`;
}

/** Word page URL. Commas are left unescaped so shared links stay readable. */
export function wordUrl(lang: string, word: string, ids: DictId[]): string {
  const v = dictsParam(ids);
  return `/${lang}/word?word=${encodeURIComponent(word)}${v === null ? "" : `&dicts=${v}`}`;
}

export const dictMask = (ids: DictId[]) => ids.reduce((m, d) => m | DICT[d], 0);

const noop = () => () => {};
/**
 * False during prerender and hydration, true afterwards. Prerendered HTML can't know the query
 * string, so URL-dependent UI renders the default state until hydration completes.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function useDicts() {
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const location = useLocation();
  // While a newly enabled dictionary's chunk loads, reflect the pending URL so the toggle responds immediately.
  const pending = useNavigation().location;
  const current = pending && pending.pathname === location.pathname ? pending : location;
  const enabled = hydrated ? parseDicts(new URLSearchParams(current.search).get("dicts")) : ALL_DICTS;
  const set = (ids: DictId[]) => {
    // keep the other params (e.g. word) in place; only replace dicts
    const parts = current.search
      .replace(/^\?/, "")
      .split("&")
      .filter((p) => p && !p.startsWith("dicts="));
    const v = dictsParam(ids);
    if (v !== null) parts.push(`dicts=${v}`);
    const search = parts.length ? `?${parts.join("&")}` : "";
    navigate({ pathname: current.pathname, search, hash: current.hash }, { replace: true, preventScrollReset: true });
  };
  const toggle = (id: DictId) => set(enabled.includes(id) ? enabled.filter((d) => d !== id) : ALL_DICTS.filter((d) => d === id || enabled.includes(d)));
  return { enabled, toggle, query: dictsQuery(enabled) };
}

/** Builds in-app links that keep the current UI language and dictionary selection. */
export function useLinks() {
  const lang = useLang();
  const { enabled, query } = useDicts();
  return {
    lang,
    word: (w: string) => wordUrl(lang, w, enabled),
    page: (p: string) => `/${lang}${p}${query}`,
  };
}
