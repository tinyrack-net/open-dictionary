// 한국어기초사전 (National Institute of Korean Language, CC BY-SA 2.0 KR) -> "krdict".
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type { DictEntry, Example, Form, GlossText, Pron, Relations, RelationKind, Sense, Translation, WordRef } from "../../app/lib/types.ts";
import { addBacklink, addEntry, compact, download, exists, list, raw, extract } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";

/**
 * The export is LMF-style JSON: every object carries its fields as `feat: [{ att, val }]` (one object
 * instead of a list when there is only one), so `feats` turns that into a map of value lists.
 *
 * Mapping, field by field, in source order:
 *   entry:  writtenForm -> word; partOfSpeech (or the lexical unit for idioms, proverbs…) -> pos;
 *           homonym_number -> etym; origin (hanja, loanword spelling) and variant -> alt;
 *           WordForm 발음 -> pron (text only, see krEntry); WordForm 활용 -> forms ("활용");
 *           RelatedForm -> relations.derived (파생어) / related (☞ cross-references);
 *           annotation -> notes
 *   sense:  definition -> gloss; equivalents' definitions -> glosses; equivalents -> translations
 *           (the source joins several with "; ": one translation each); syntacticPattern, annotation,
 *           syntacticAnnotation -> notes; SenseExample -> examples (each turn of a dialogue on its own
 *           line); SenseRelation -> relations by type (유의어, 반대말, 참고어, 준말 …, tagged as such)
 *
 * Equivalents are read for the languages in EQUIVALENTS (English, Japanese). Every equivalent also gives
 * the translated word a backlink, like Wiktionary's translations.
 *
 * License: the text is CC BY-SA 2.0 KR. Its share-alike clause applies to this converted data, which
 * is redistributed under the same license (d/krdict/), credited to 국립국어원 with a link to the license.
 */
type Feats = Record<string, string[]>;

/**
 * The export writes its text XML-escaped (&quot; &apos; &lt; &gt; &lsqb; &rsqb;), and a few values
 * wrap a word in <I>…</I> for italics. Both are encoding, not content: decode the escapes and drop
 * the italic markup, keeping the text.
 */
const ENTITIES: Record<string, string> = { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&", lsqb: "[", rsqb: "]" };
const krText = (v: string) =>
  v
    .replace(/&(quot|apos|lt|gt|lsqb|rsqb);/g, (_, e: string) => ENTITIES[e])
    .replace(/<\/?I>/gi, "")
    .replace(/&amp;/g, "&");

function feats(f: any): Feats {
  const out: Feats = {};
  for (const x of list<any>(f)) if (x?.att && typeof x.val === "string") (out[x.att] ??= []).push(krText(x.val));
  return out;
}
const one = (f: Feats, k: string) => f[k]?.[0]?.trim() || undefined;

/** The source's relation types: synonyms and antonyms by kind, every other type as a tagged related word. */
const KR_RELATION: Record<string, RelationKind> = { 유의어: "synonyms", 반대말: "antonyms" };

/**
 * Equivalent languages used, by the source's language name -> code. The export has 11 languages per
 * sense; these are the ones the site has dictionaries in. Add one here to use another.
 */
const EQUIVALENTS: Record<string, string> = { 영어: "en", 일본어: "ja" };

/**
 * How each language writes several equivalents in one field, and which words in an equivalent a
 * backlink goes to:
 *   English  "eat; have; consume"                       -> eat | have | consume
 *   Japanese "せんえいだ【先鋭だ・尖鋭だ】。するどい【鋭い】" -> one equivalent per "。", each kept as
 *            written; it links the kana reading and every kanji spelling (せんえいだ, 先鋭だ, 尖鋭だ).
 *            "(対訳語無し)" means the source has no equivalent.
 */
const SPLIT: Record<string, (v: string) => string[]> = {
  en: (v) => v.split(/\s*;\s*/),
  ja: (v) => v.split("。").filter((x) => !/^\(対訳語無し\)$/.test(x.trim())),
};
const LINKED: Record<string, (word: string) => string[]> = {
  en: (w) => [w],
  ja: (w) => {
    const m = /^([^【]*)【([^】]*)】/.exec(w);
    return m ? [m[1], ...m[2].split("・")].map((x) => x.trim()).filter(Boolean) : [w];
  },
};
/** Words an equivalent links to (backlinks): see LINKED. */
export const linkedWords = (t: Translation) => (LINKED[t.lang] ?? LINKED.en)(t.word);

function krSense(s: any): Sense {
  const f = feats(s.feat);
  const eq = list<any>(s.Equivalent)
    .map((q) => feats(q.feat))
    .filter((q) => EQUIVALENTS[one(q, "language") ?? ""])
    .map((q) => ({ lang: EQUIVALENTS[one(q, "language")!], lemma: one(q, "lemma"), definition: one(q, "definition") }));
  const relations: Relations = {};
  for (const r of list<any>(s.SenseRelation)) {
    const rf = feats(r.feat);
    const type = one(rf, "type");
    const word = one(rf, "lemma");
    if (!type || !word) continue;
    const kind = KR_RELATION[type] ?? "related";
    (relations[kind] ??= []).push(compact({ word, tags: kind === "related" ? [type] : undefined }));
  }
  return compact({
    gloss: one(f, "definition") ?? "",
    glosses: eq.flatMap((q): GlossText[] => (q.definition ? [{ lang: q.lang, text: q.definition }] : [])),
    notes: [...(f.syntacticPattern ?? []), ...(f.annotation ?? []), ...(f.syntacticAnnotation ?? [])].map((x) => x.trim()).filter(Boolean),
    // several equivalents in one field: one translation each, in order, as written (see SPLIT)
    translations: eq.flatMap((q) =>
      (SPLIT[q.lang] ?? SPLIT.en)(q.lemma ?? "")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((word): Translation => ({ word, lang: q.lang })),
    ),
    examples: list<any>(s.SenseExample).flatMap((x): Example[] => {
      const xf = feats(x.feat);
      const text = (xf.example ?? []).map((t) => t.trim()).filter(Boolean);
      return text.length ? [{ text: text.join("\n") }] : [];
    }),
    relations: compact(relations),
  });
}

function krEntry(e: any): DictEntry | undefined {
  const f = feats(e.feat);
  const lemmas = list<any>(e.Lemma).map((l) => feats(l.feat));
  const word = lemmas.map((l) => one(l, "writtenForm")).find(Boolean);
  if (!word) return undefined;
  const pos = one(f, "partOfSpeech");
  const unit = one(f, "lexicalUnit");
  const homonym = Number(one(f, "homonym_number") ?? 0);
  const wordForms = list<any>(e.WordForm).map((w) => ({ f: feats(w.feat), short: feats(w.FormRepresentation?.feat) }));
  const sounds = wordForms.filter((w) => one(w.f, "type") === "발음");
  const conj = wordForms.filter((w) => one(w.f, "type") === "활용");
  const related = list<any>(e.RelatedForm).map((r) => feats(r.feat));
  return compact({
    word,
    // idioms and proverbs have no part of speech; the source's lexical unit names what they are
    pos: pos && pos !== "품사 없음" ? pos : (unit ?? pos ?? ""),
    etym: homonym > 0 ? homonym : undefined,
    alt: [...(f.origin ?? []), ...lemmas.flatMap((l) => l.variant ?? [])].map((x) => x.trim()).filter(Boolean),
    pron: sounds.flatMap((w) => (w.f.pronunciation ?? []).map((text): Pron => ({ text, kind: "pronunciation" }))),
    // Recordings are not used: the site's copyright policy licenses its text under CC BY-SA 2.0 KR but
    // gives multimedia files (sound, images, video) their own per-file terms, which the export doesn't
    // include. Only the written pronunciation (text) is kept.
    forms: conj.flatMap((w): Form[] => [
      ...(one(w.f, "writtenForm") ? [compact({ form: one(w.f, "writtenForm")!, tags: ["활용"] })] : []),
      ...(one(w.short, "writtenForm") ? [compact({ form: one(w.short, "writtenForm")!, tags: ["활용", one(w.short, "type")!].filter(Boolean) })] : []),
    ]),
    notes: (f.annotation ?? []).map((x) => x.trim()).filter(Boolean),
    senses: list<any>(e.Sense).map(krSense).filter((s) => s.gloss),
    relations: compact({
      derived: related.filter((r) => one(r, "type") === "파생어" && one(r, "writtenForm")).map((r): WordRef => ({ word: one(r, "writtenForm")! })),
      related: related.filter((r) => one(r, "type") !== "파생어" && one(r, "writtenForm")).map((r): WordRef => compact({ word: one(r, "writtenForm")!, tags: [one(r, "type")!] })),
    } as Relations),
  });
}


const ID = "krdict";

export default {
  name: "한국어기초사전",
  dictionaries: [ID],
  fetch() {
    // The full JSON export. The download id changes with every monthly upload, so it is read from the
    // download page (the JSON button).
    if (exists("krdict")) return;
    if (!exists("krdict.zip")) {
      const page = execFileSync("curl", ["-fsSL", "--retry", "5", "-A", "Mozilla/5.0", "https://krdict.korean.go.kr/download/downloadPopup"], { encoding: "utf8" });
      const ids = [...page.matchAll(/batchDownload\('(\d+)'\)/g)].map((m) => m[1]);
      const json = /batchDownload\('(\d+)'\)[^<]*<i[^>]*><\/i>\s*Json/i.exec(page)?.[1] ?? ids[2];
      if (!json) throw new Error("krdict: JSON download id not found on the download page");
      download("krdict.zip", `https://krdict.korean.go.kr/dicBatchDownload?seq=${json}`, { userAgent: "Mozilla/5.0" });
    }
    extract("krdict.zip", "krdict");
  },
  build() {
    if (!exists("krdict")) return "skipped (raw/krdict missing)";
    // files are numbered 1_…, 2_…, 10_…: read them in that (numeric) order, which is the source's order
    const files = fs.readdirSync(raw("krdict")).filter((f) => f.endsWith(".json")).sort((a, b) => parseInt(a) - parseInt(b));
    let count = 0;
    let backlinks = 0;
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(raw("krdict", file), "utf8"));
      for (const e of list<any>(data.LexicalResource?.Lexicon?.LexicalEntry)) {
        const entry = krEntry(e);
        if (!entry || !entry.senses.length) continue;
        addEntry(ID, entry);
        count++;
        for (const s of entry.senses)
          for (const t of s.translations ?? [])
            for (const w of linkedWords(t)) if (addBacklink(ID, w, { word: entry.word, lang: "ko", pos: entry.pos, sense: s.gloss })) backlinks++;
      }
    }
    return `${count} entries from ${files.length} files, ${backlinks} backlinks on equivalents`;
  },
} satisfies Source;
