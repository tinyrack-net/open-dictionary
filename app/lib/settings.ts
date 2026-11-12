// Every user setting lives in the URL, so a link always reproduces exactly what was on screen.
//
//   /{lang}/word?word=love&dicts=wordnet,en-ko&theme=dark
//    │             │          │                  └ theme:  auto (omitted) | light | dark
//    │             │          └ dicts:  dictionary slugs (omitted = all)
//    │             └ word:   the headword (word page only)
//    └ lang:   UI language (path segment, so prerendered HTML is already in the right language)
//
// Nothing is stored in localStorage or cookies.
import {
  applyTinyrackColorScheme,
  isTinyrackColorSchemePreference,
  TINYRACK_COLOR_SCHEME_MEDIA_QUERY,
  type TinyrackColorSchemePreference,
} from "@tinyrack/ui/providers/color-scheme";
import { useEffect, useSyncExternalStore } from "react";
import { type Location, useLocation, useNavigate, useNavigation, useParams } from "react-router";
import { DICT, type DictId } from "./keys";

// ---------------------------------------------------------------- UI language

export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** Browser language, used only to pick a UI language for "/". */
export function browserLang(): Lang {
  const langs = typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
  return langs.some((l) => l?.toLowerCase().startsWith("ko")) ? "ko" : DEFAULT_LANG;
}

// ---------------------------------------------------------------- dictionaries

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

export const dictMask = (ids: DictId[]) => ids.reduce((m, d) => m | DICT[d], 0);

// ---------------------------------------------------------------- theme

export type Theme = TinyrackColorSchemePreference;
export const THEMES: Theme[] = ["auto", "light", "dark"];
export const parseTheme = (v: string | null): Theme => (isTinyrackColorSchemePreference(v) ? v : "auto");

/**
 * Inline <head> script: applies ?theme= before first paint so a dark link never flashes light.
 * Mirrors applyTinyrackColorScheme (data-theme + color-scheme on <html>).
 */
export const THEME_SCRIPT = `(() => {
  try {
    var p = new URLSearchParams(location.search).get("theme");
    var dark = p === "dark" || (p !== "light" && matchMedia(${JSON.stringify(TINYRACK_COLOR_SCHEME_MEDIA_QUERY)}).matches);
    var t = dark ? "tinyrack-dark" : "tinyrack-light";
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();`;

/** Keeps <html data-theme> in sync with ?theme= and, for "auto", with the OS setting. */
export function useApplyTheme() {
  const { search } = useLocation();
  const theme = parseTheme(new URLSearchParams(search).get("theme"));
  useEffect(() => {
    const media = window.matchMedia(TINYRACK_COLOR_SCHEME_MEDIA_QUERY);
    const apply = () => applyTinyrackColorScheme(document.documentElement, theme, media.matches);
    apply();
    if (theme !== "auto") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

// ---------------------------------------------------------------- settings in the URL

export interface Settings {
  lang: Lang;
  dicts: DictId[];
  theme: Theme;
}

/** Search-string value for each setting, or null when it is the default (omitted from the URL). */
function settingParams(s: Pick<Settings, "dicts" | "theme">): [string, string][] {
  const out: [string, string][] = [];
  if (s.dicts.length !== ALL_DICTS.length) out.push(["dicts", s.dicts.map((d) => slugOf.get(d)).join(",")]);
  if (s.theme !== "auto") out.push(["theme", s.theme]);
  return out;
}

/**
 * Builds a search string from ordered [key, value] pairs. Commas in dicts stay readable
 * (URLSearchParams would escape them as %2C).
 */
function toSearch(pairs: [string, string][]): string {
  if (!pairs.length) return "";
  return "?" + pairs.map(([k, v]) => `${k}=${k === "dicts" ? v : encodeURIComponent(v)}`).join("&");
}

/** Word page URL carrying the given settings. */
export function wordHref(s: Settings, word: string): string {
  return `/${s.lang}/word${toSearch([["word", word], ...settingParams(s)])}`;
}

/** Any other page (home "", "/about") carrying the given settings. */
export function pageHref(s: Settings, path: string): string {
  return `/${s.lang}${path}${toSearch(settingParams(s))}`;
}

const noop = () => () => {};
/** False during prerender and hydration, true afterwards (prerendered HTML can't know the query string). */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function readSettings(lang: string | undefined, search: string, hydrated: boolean): Settings {
  const params = new URLSearchParams(search);
  return {
    lang: isLang(lang) ? lang : DEFAULT_LANG,
    dicts: hydrated ? parseDicts(params.get("dicts")) : ALL_DICTS,
    theme: hydrated ? parseTheme(params.get("theme")) : "auto",
  };
}

/**
 * Current settings plus helpers that change them. Changing a setting replaces the history entry
 * and keeps every other part of the URL (path, word, other settings).
 */
export function useSettings() {
  const { lang } = useParams();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const location = useLocation();
  // While the next page loads (e.g. a newly enabled dictionary's chunk), reflect the pending URL
  // so controls respond immediately.
  const pending = useNavigation().location;
  const current: Location = pending && pending.pathname === location.pathname ? pending : location;
  const settings = readSettings(lang, current.search, hydrated);

  const update = (next: Partial<Pick<Settings, "dicts" | "theme">>) => {
    const params = new URLSearchParams(current.search);
    const word = params.get("word");
    const merged = { ...settings, ...next };
    const search = toSearch([...(word !== null ? ([["word", word]] as [string, string][]) : []), ...settingParams(merged)]);
    navigate({ pathname: current.pathname, search, hash: current.hash }, { replace: true, preventScrollReset: true });
  };

  return {
    ...settings,
    setDicts: (dicts: DictId[]) => update({ dicts }),
    setTheme: (theme: Theme) => update({ theme }),
    /** Same page in another UI language. */
    langHref: (l: Lang) => `/${l}${current.pathname.replace(/^\/[^/]+/, "")}${current.search}`,
    wordHref: (w: string) => wordHref(settings, w),
    pageHref: (p: string) => pageHref(settings, p),
  };
}
