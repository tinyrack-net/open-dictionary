// Selected dictionaries live in the URL (?dicts=wordnet,en-ko) so a link reproduces exactly what was on screen.
import { useSyncExternalStore } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
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

export function dictsQuery(ids: DictId[]): string {
  if (ids.length === ALL_DICTS.length) return "";
  return `?dicts=${ids.map((d) => slugOf.get(d)).join(",")}`;
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
  const [params] = useSearchParams();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const location = useLocation();
  const enabled = hydrated ? parseDicts(params.get("dicts")) : ALL_DICTS;
  const set = (ids: DictId[]) => {
    const rest = new URLSearchParams(location.search);
    rest.delete("dicts");
    const own = dictsQuery(ids);
    const other = rest.toString();
    const search = own ? own + (other ? `&${other}` : "") : other ? `?${other}` : "";
    navigate({ pathname: location.pathname, search, hash: location.hash }, { replace: true, preventScrollReset: true });
  };
  const toggle = (id: DictId) => set(enabled.includes(id) ? enabled.filter((d) => d !== id) : ALL_DICTS.filter((d) => d === id || enabled.includes(d)));
  return { enabled, toggle, query: dictsQuery(enabled) };
}

/** Builds in-app links that keep the current UI language and dictionary selection. */
export function useLinks() {
  const lang = useLang();
  const { query } = useDicts();
  return {
    lang,
    word: (w: string) => `/${lang}/word/${encodeURIComponent(w)}${query}`,
    page: (p: string) => `/${lang}${p}${query}`,
  };
}
