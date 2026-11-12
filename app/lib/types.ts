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
export interface WiktEntry {
  word: string;
  pos: string;
  ipa?: { v: string; tags?: string[] }[];
  ety?: string;
  forms?: { f: string; tags?: string[] }[];
  roman?: string; // Korean romanization
  hanja?: string;
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

/** All data for one headword, assembled in the browser from the per-dictionary chunks. */
export interface Entry {
  w: string; // display headword
  wn?: WnEntry[];
  en?: WiktEntry[];
  enko?: EnKoGroup[];
  ko?: WiktEntry[];
  koRev?: KoReverse[];
}

/** What each dictionary chunk stores per key. */
export interface DictData {
  wn: WnEntry[];
  en: WiktEntry[];
  enko: EnKoGroup[];
  ko: { ko?: WiktEntry[]; rev?: KoReverse[] };
}

/** Index row: [display headword, dictionary bitmask]. */
export type IndexRow = [string, number];
