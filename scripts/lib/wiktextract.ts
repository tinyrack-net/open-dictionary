// Converter for wiktextract JSONL (kaikki.org), the format of every Wiktionary edition. Sources built
// from Wiktionary (scripts/sources/wiktionary*.ts …) call wiktEntry() per line; edition-specific quirks
// are handled by the source module, not here.
import type { Audio, DictEntry, Example, Form, FormTable, Pron, Relations, RelationKind, Sense, Translation, WordRef } from "../../app/lib/types.ts";
import { compact, strs } from "./core.ts";

/**
 * wiktextract bookkeeping tags: they describe how wiktextract parsed the page, not the word, so they
 * are dropped. Every other tag is kept verbatim.
 */
const PARSER_TAGS = new Set(["table-tags", "inflection-template", "error-unknown-tag", "no-gloss", "class"]);
export const tagsOf = (xs: unknown) => strs(xs)?.filter((t) => !PARSER_TAGS.has(t));

/** wiktextract prefixes the rendered etymology tree to the prose; keep only the prose. */
function etymologyText(text?: string): string | undefined {
  if (!text) return undefined;
  if (text.startsWith("Etymology tree")) {
    const lines = text.split("\n").filter(Boolean);
    text = lines[lines.length - 1];
  }
  return text.trim() || undefined;
}

function prons(o: any): Pron[] {
  const out: Pron[] = [];
  for (const s of o.sounds ?? []) {
    for (const kind of ["ipa", "enpr"] as const) if (s[kind]) out.push(compact({ text: s[kind], kind, tags: tagsOf(s.tags) }));
  }
  return out;
}

function audios(o: any): Audio[] {
  return (o.sounds ?? [])
    .filter((s: any) => typeof s.mp3_url === "string")
    .map((s: any): Audio => compact({ url: s.mp3_url, tags: tagsOf(s.tags) }));
}

/**
 * wiktextract mixes two things in `forms`: the headline forms printed next to the headword (no
 * `source`) and full inflection tables (`source: "conjugation" | "declension" | "inflection"`).
 * They are kept apart, each complete and in source order. Romanizations and alternative scripts
 * (e.g. hanja) are pronunciation and spelling data, stored in `pron` and `alt`.
 */
const isForm = (f: any) => f.form && !f.tags?.some((t: string) => PARSER_TAGS.has(t) || t === "romanization" || t === "hanja");
const form = (f: any): Form => compact({ form: f.form, tags: tagsOf(f.tags) });
function wiktForms(o: any): Form[] {
  return (o.forms ?? []).filter((f: any) => isForm(f) && !f.source).map(form);
}
function wiktTables(o: any): FormTable[] {
  const tables = new Map<string, Form[]>();
  for (const f of o.forms ?? []) {
    if (!isForm(f) || !f.source) continue;
    tables.set(f.source, [...(tables.get(f.source) ?? []), form(f)]);
  }
  return [...tables].map(([kind, forms]) => ({ kind, forms }));
}

const refs = (xs: any[] | undefined): WordRef[] =>
  (xs ?? []).filter((x) => x?.word).map((x) => compact({ word: x.word, note: x.english ?? x.translation, tags: tagsOf(x.tags) }));

const RELATIONS: RelationKind[] = ["synonyms", "antonyms", "hypernyms", "hyponyms", "related", "derived"];
function wiktRelations(o: any): Relations {
  return compact(Object.fromEntries(RELATIONS.map((k) => [k, refs(o[k])])) as Relations);
}

/** A translation item of one language, as it is in the source. */
export const isTranslationIn = (lang: string) => (t: any) => (t.lang_code ?? t.code) === lang && t.word;
export const translation = (t: any, lang: string): Translation => compact({ word: t.word, lang, roman: t.roman, alt: t.alt, tags: tagsOf(t.tags) });

function wiktSenses(o: any): Sense[] {
  const out: Sense[] = [];
  for (const s of o.senses ?? []) {
    const glosses: string[] | undefined = s.glosses;
    if (!glosses?.length) continue;
    out.push(
      compact({
        gloss: glosses[glosses.length - 1],
        parent: glosses.length > 1 ? glosses.slice(0, -1).join(" › ") : undefined,
        tags: tagsOf(s.tags),
        formOf: [...(s.form_of ?? []), ...(s.alt_of ?? [])].map((x: any) => x.word).filter(Boolean),
        examples: (s.examples ?? [])
          .filter((x: any) => x.text)
          .map((x: any): Example => compact({ text: x.text, translation: x.english ?? x.translation, roman: x.roman, ref: x.ref })),
        relations: wiktRelations(s),
      }),
    );
  }
  return out;
}

/** One wiktextract line (headword × part of speech × etymology) as a neutral entry. */
export function wiktEntry(o: any): DictEntry {
  return compact({
    word: o.word,
    pos: o.pos,
    etym: o.etymology_number ? Number(o.etymology_number) : undefined,
    alt: (o.forms ?? []).filter((f: any) => f.tags?.includes("hanja")).map((f: any) => f.form),
    pron: [
      ...prons(o),
      ...(o.forms ?? []).filter((f: any) => f.tags?.includes("romanization")).map((f: any): Pron => ({ text: f.form, kind: "romanization" })),
    ],
    audio: audios(o),
    forms: wiktForms(o),
    tables: wiktTables(o),
    etymology: etymologyText(o.etymology_text ?? o.etymology_texts?.join("\n")),
    senses: wiktSenses(o),
    relations: wiktRelations(o),
  });
}

/**
 * Reads a wiktextract file of one language into a dictionary: one entry per line that has at least
 * one sense. `prepare` adapts an edition's quirks before conversion; `each` sees every kept line.
 */
export async function loadWiktionary(
  id: string,
  file: string,
  lang: string,
  opts: { prepare?: (o: any) => any; each?: (o: any, entry: DictEntry) => void } = {},
): Promise<number> {
  const { jsonl, addEntry } = await import("./core.ts");
  let count = 0;
  for await (const line of jsonl(file)) {
    if (!line.word || line.lang_code !== lang) continue;
    const o = opts.prepare ? opts.prepare(line) : line;
    const entry = wiktEntry(o);
    if (!entry.senses?.length) continue;
    addEntry(id, entry);
    opts.each?.(o, entry);
    count++;
  }
  return count;
}
