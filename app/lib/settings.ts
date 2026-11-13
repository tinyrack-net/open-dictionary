// Every user setting lives in the URL, so a link always reproduces exactly what was on screen.
//
//   /{lang}/word?word=love&dicts=wordnet,en-ko&theme=dark
//    │             │          │                  └ theme:  auto (omitted) | light | dark
//    │             │          └ dicts:  dictionary slugs (omitted = all)
//    │             └ word:   the headword (word page only)
//    └ lang:   UI language (path segment, so prerendered HTML is already in the right language)
//
// Settings are never stored in localStorage or cookies. (Personal lists, i.e. search history and
// saved words, are kept on the device: see history.ts.)
import {
  applyTinyrackColorScheme,
  isTinyrackColorSchemePreference,
  TINYRACK_COLOR_SCHEME_MEDIA_QUERY,
  type TinyrackColorSchemePreference,
} from "@tinyrack/ui/providers/color-scheme";
import { useEffect, useSyncExternalStore } from "react";
import { type Location, useLocation, useNavigate, useNavigation, useParams } from "react-router";
import { ALL_DICTS, DEFAULT_LANG, isLang, type Lang, parseDicts, slugOf } from "./dicts.ts";
import type { DictId } from "./keys.ts";

export { ALL_DICTS, DEFAULT_LANG, DICTIONARIES, dictMask, isLang, LANGS, type Lang, parseDicts } from "./dicts.ts";

// ---------------------------------------------------------------- UI language

/** Browser language, used only to pick a UI language for "/". */
export function browserLang(): Lang {
  const langs = typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
  return langs.some((l) => l?.toLowerCase().startsWith("ko")) ? "ko" : DEFAULT_LANG;
}

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
