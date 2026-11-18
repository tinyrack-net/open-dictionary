// English UI strings: the reference locale. Every other locale has the same keys (typeof en).
// Dictionary names and descriptions live in the registry (app/lib/dicts.ts), not here.
import type { RelationKind } from "../lib/types.ts";

const en = {
  /** the language's own name, shown in the language menu */
  langName: "English",
  siteName: "Open Dictionary",
  /** home page meta description, given the dictionary sources ("WordNet, Wiktionary, …") */
  siteDescription: (sources: string) => `A free, open-data dictionary built from ${sources}.`,
  /** search box placeholder, given the headword languages ("English or Korean") */
  searchPlaceholder: (langs: string) => `Search ${langs}…`,
  /** joins a list in running text: "A, B or C" */
  orList: (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`),
  andList: (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`),
  search: "Search",
  dictionaries: "Dictionaries",
  etymology: "Etymology",
  etymNumber: (n: number) => `Etymology ${n}`,
  forms: "Forms",
  /** title of a full inflection table; `kind` is the source's own name for it (conjugation, declension, …) */
  formTable: (kind: string) => `Full ${kind}`,
  relations: {
    synonyms: "Synonyms",
    antonyms: "Antonyms",
    hypernyms: "Broader terms",
    hyponyms: "Narrower terms",
    related: "Related",
    derived: "Derived terms",
  } as Record<RelationKind, string>,
  backlinksTitle: "Given as a translation of",
  /** language names (BCP 47 code -> name), e.g. for a definition written in another language */
  languages: { en: "English", ko: "Korean", ja: "Japanese" } as Record<string, string>,
  /** short language names for language pairs ("en" -> "English"; Korean uses 영, 한, 일) */
  langShort: { en: "English", ko: "Korean", ja: "Japanese" } as Record<string, string>,
  /** a dictionary's language pair: headwords in `head`, definitions in `gloss` */
  langPair: (head: string, gloss: string, short: Record<string, string>) => `${short[head] ?? head}–${short[gloss] ?? gloss}`,
  /** label of a sentence corpus in place of a language pair */
  sentencesLabel: "Sentences",
  /** settings: the dictionary list */
  dictionaryOrder: "Dictionaries and order",
  dictionaryOrderHint: "Shown on word pages in this order. Turn dictionaries on or off and move them up or down.",
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  resetOrder: "Reset to default",
  done: "Done",
  appearance: "Appearance",
  pairsTitle: "Example sentences",
  notFound: "No entry found.",
  offline: "You're offline. Words you've opened before still work; this one needs a connection.",
  didYouMean: "Did you mean",
  onlyIn: (names: string) => `This word is only in: ${names}. Turn it on in Settings.`,
  noneSelected: "No dictionary selected. Choose at least one in Settings.",
  showAll: (n: number) => `Show all ${n}`,
  showMore: (rest: number) => `Show more (${rest} left)`,
  play: (label: string) => `Play pronunciation (${label})`,
  playGeneric: "Play pronunciation",
  save: "Save word",
  savedWords: "Saved words",
  recent: "Recent",
  removeItem: (w: string) => `Remove ${w}`,
  clearAll: "Clear all",
  nothingSaved: "No saved words yet. Tap the bookmark on a word page to save it.",
  storedOnDevice: "Stored on this device only.",
  sourcesLicenses: "Sources & licenses",
  aboutIntro:
    "Every definition on this site comes from openly licensed data and is shown as the source wrote it. The processed data of each dictionary is redistributed under that dictionary's license, listed below and on every word page.",
  pageNotFound: "The requested page could not be found.",
  backToSearch: "Back to search",
  language: "Language",
  settings: "Settings",
  theme: "Theme",
  themes: { auto: "System", light: "Light", dark: "Dark" },
  pronunciation: "Pronunciation",
  searchResults: "Suggestions",
  clear: "Clear",
  loading: "Loading…",
  /** source tag -> UI label (English UI: verbatim) */
  tags: {} as Record<string, string>,
  /** source part of speech -> UI label (English UI: verbatim) */
  pos: {} as Record<string, string>,
};

export default en;
export type Strings = typeof en;
