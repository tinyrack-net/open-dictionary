// Unified entry format produced by scripts/build-data.ts.

export interface WnSense {
  def: string;
  ex?: string[];
  syn?: string[]; // other lemmas of the same synset
  broader?: string[]; // hypernym lemmas ("type of")
}
export interface WnEntry {
  lemma: string;
  pos: string;
  pron?: { v: string; var?: string }[];
  senses: WnSense[];
}

export interface WiktSense {
  g: string; // gloss
  parent?: string; // parent gloss for sub-senses
  tags?: string[];
  ex?: { t: string; roman?: string; en?: string }[];
  syn?: string[];
  of?: string; // "form of" / "alternative of" target headword
}
/** A recorded pronunciation on Wikimedia Commons. */
export interface Audio {
  /** "US" | "UK" | other accent label */
  tag?: string;
  /** path under https://upload.wikimedia.org/wikipedia/commons/ (mp3 transcode) */
  mp3: string;
}

export interface WiktEntry {
  word: string;
  pos: string;
  /** Wiktionary etymology number: separates homographs (사랑 "love" vs 사랑 舍廊). */
  etym?: number;
  ipa?: { v: string; tags?: string[] }[];
  audio?: Audio[];
  ety?: string;
  forms?: { f: string; tags?: string[] }[];
  roman?: string; // Korean romanization
  hanja?: string;
  /** derived/related headwords (사랑 -> 사랑하다, 사랑니), with a short English gloss when known */
  derived?: { w: string; en?: string }[];
  senses: WiktSense[];
}

export interface KoTranslation {
  w: string;
  roman?: string;
  alt?: string; // hanja
  tags?: string[];
}
export interface EnKoGroup {
  word: string;
  pos: string;
  sense: string;
  ko: KoTranslation[];
}

export interface KoReverse {
  en: string;
  pos: string;
  sense: string;
}

/** A bilingual example sentence pair (Tatoeba). */
export interface SentencePair {
  en: string;
  ko: string;
}

/** All data for one headword, assembled in the browser from the per-dictionary chunks. */
export interface Entry {
  w: string; // display headword
  /** Zipf frequency (wordfreq): ~7 for "the", ~5 common, ~3 rare; absent when unknown. */
  freq?: number;
  wn?: WnEntry[];
  en?: WiktEntry[];
  enko?: EnKoGroup[];
  ko?: WiktEntry[];
  koRev?: KoReverse[];
  /** bilingual example sentences (loaded with the translation dictionaries) */
  pairs?: SentencePair[];
}

/** What each dictionary chunk stores per key. */
export interface DictData {
  wn: WnEntry[];
  en: WiktEntry[];
  enko: EnKoGroup[];
  ko: { ko?: WiktEntry[]; rev?: KoReverse[] };
  ex: SentencePair[];
}

/** Index row: [display headword, dictionary bitmask, Zipf frequency x10 (0 = unknown)]. */
export type IndexRow = [string, number, number?];
