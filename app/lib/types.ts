// The neutral dictionary format. Every source is converted into this one shape by its converter in
// scripts/build-data.ts, and the word page renders it with one generic renderer.
//
// Rules for converters (see README "Data model"):
//   - Copy, don't compose. Every field comes from the source. Nothing is invented, merged across
//     entries, ranked, or summarized.
//   - Keep the source's order (entries, senses, forms, examples) and its grammar tags verbatim.
//   - Keep everything. No truncation or caps; the UI collapses long lists the same way for every source.
//   - Omit empty fields.
//
// Rules for the renderer: no code that depends on which source it is rendering.

/** A recorded pronunciation. `url` is absolute; `tags` are the source's accent/region labels. */
export interface Audio {
  url: string;
  tags?: string[];
}

/** A pronunciation transcription (IPA, romanization, …) with the source's labels. */
export interface Pron {
  text: string;
  /** what kind of transcription: "ipa", "enpr", "romanization", … */
  kind?: string;
  tags?: string[];
}

/** An inflected or variant form, with the source's grammar tags, e.g. { form: "did", tags: ["past"] }. */
export interface Form {
  form: string;
  tags?: string[];
}

/**
 * A full inflection table as the source gives it (Wiktionary's conjugation/declension tables), kept
 * separately from the headline forms. `kind` is the source's name for the table.
 */
export interface FormTable {
  kind: string;
  forms: Form[];
}

/** A reference to another headword, e.g. a synonym or a derived word. `note` is the source's gloss. */
export interface WordRef {
  word: string;
  note?: string;
  tags?: string[];
}

export interface Example {
  text: string;
  /** translation into the other language, when the source gives one */
  translation?: string;
  /** romanization, when the source gives one */
  roman?: string;
  /** citation ("1988, Andrew Radford, …") */
  ref?: string;
}

/** A translation of one sense into another language. */
export interface Translation {
  word: string;
  lang: string;
  roman?: string;
  /** alternative script, e.g. hanja */
  alt?: string;
  tags?: string[];
}

/** Named word lists attached to a sense, e.g. { synonyms: [...], hypernyms: [...] }. */
export type Relations = Partial<Record<RelationKind, WordRef[]>>;
export type RelationKind = "synonyms" | "antonyms" | "hypernyms" | "hyponyms" | "related" | "derived";

export interface Sense {
  /** the definition, as written by the source */
  gloss: string;
  /** broader sense this one belongs to (Wiktionary sub-senses) */
  parent?: string;
  tags?: string[];
  /** headword(s) this sense is a form of, with the source's wording kept in `gloss` */
  formOf?: string[];
  examples?: Example[];
  translations?: Translation[];
  relations?: Relations;
}

/** One entry of one source: a headword with one part of speech (and etymology, where the source splits them). */
export interface DictEntry {
  /** headword as the source spells it */
  word: string;
  /** part of speech, as the source labels it */
  pos: string;
  /** the source's etymology number, when it splits homographs (사랑 1 "love", 사랑 2 舍廊) */
  etym?: number;
  /** alternative spellings in another script, e.g. hanja */
  alt?: string[];
  pron?: Pron[];
  audio?: Audio[];
  /** headline forms, the ones the source shows next to the headword */
  forms?: Form[];
  /** full inflection tables, when the source has them */
  tables?: FormTable[];
  etymology?: string;
  senses: Sense[];
  relations?: Relations;
}

/**
 * A fact from another source pointing at this headword: "this word is given as a translation of
 * `word` in `source`". Rendered as such, never as a definition.
 */
export interface Backlink {
  word: string;
  lang: string;
  pos: string;
  /** the gloss of the sense that has this translation */
  sense: string;
}

/** Example sentence pair from a parallel corpus, matched by an exact whole-word occurrence. */
export interface SentencePair {
  en: string;
  ko: string;
}

/** What each data chunk stores per headword key. */
export interface DictData {
  /** Open English WordNet */
  wn: DictEntry[];
  /** English Wiktionary, English entries */
  en: DictEntry[];
  /** English Wiktionary, Korean translations of English entries (one entry per English entry) */
  enko: DictEntry[];
  /** English Wiktionary, Korean entries + backlinks from English entries' Korean translations */
  ko: { entries?: DictEntry[]; backlinks?: Backlink[] };
  /** Tatoeba English–Korean pairs */
  ex: SentencePair[];
}

/** Everything loaded for one headword, per source, in the order the user selected the sources. */
export interface Entry {
  w: string;
  wn?: DictEntry[];
  en?: DictEntry[];
  enko?: DictEntry[];
  ko?: DictEntry[];
  koBacklinks?: Backlink[];
  pairs?: SentencePair[];
}

/**
 * Index row: [display headword, dictionary bitmask, Zipf frequency x10 (0 = unknown)].
 * Frequency only ranks search suggestions; it is never shown.
 */
export type IndexRow = [string, number, number?];
