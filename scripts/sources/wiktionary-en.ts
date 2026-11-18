// English Wiktionary (kaikki.org, CC BY-SA 4.0) -> several dictionaries:
//   "wiktionary"   English entries
//   "en-ko", "en-ja"  translations of English entries into each language of TRANSLATIONS: one entry per
//                  English entry with the same headword and part of speech, whose senses carry only the
//                  translations (Wiktionary keeps them per sense). Each translated word also gets a
//                  backlink ("given as a translation of …") in that language's dictionary below.
//   "ko-en", "ja-en"  English Wiktionary's Korean and Japanese entries (English definitions) + those backlinks
//
// To add a language: its kaikki.org file in ENTRIES and its dictionaries in TRANSLATIONS, both
// registered in app/lib/dicts.ts.
import type { Sense } from "../../app/lib/types.ts";
import { addBacklink, addEntry, compact, download, exists, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";
import { isTranslationIn, loadWiktionary, translation } from "../lib/wiktextract.ts";

/** Language -> dictionary for translations of English entries, and for backlinks on the translated words. */
const TRANSLATIONS: Record<string, { translations: string; backlinks: string }> = {
  ko: { translations: "en-ko", backlinks: "ko-en" },
  ja: { translations: "en-ja", backlinks: "ja-en-wiktionary" },
};

/** Entries of other languages in English Wiktionary: language -> raw file, dictionary, kaikki.org name. */
const ENTRIES: { lang: string; file: string; dict: string; name: string }[] = [
  { lang: "ko", file: "ko.jsonl.gz", dict: "ko-en", name: "Korean" },
  { lang: "ja", file: "enwikt-ja.jsonl.gz", dict: "ja-en-wiktionary", name: "Japanese" },
];

export default {
  name: "English Wiktionary",
  dictionaries: ["wiktionary", ...Object.values(TRANSLATIONS).flatMap((t) => [t.translations, t.backlinks]), ...ENTRIES.map((e) => e.dict)],
  fetch() {
    download("en.jsonl.gz", "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl", { gzip: true });
    for (const e of ENTRIES) download(e.file, `https://kaikki.org/dictionary/${e.name}/kaikki.org-dictionary-${e.name}.jsonl`, { gzip: true });
  },
  async build() {
    if (!exists("en.jsonl.gz")) return "skipped (raw/en.jsonl.gz missing)";
    const counts: Record<string, number> = {};
    const english = await loadWiktionary("wiktionary", raw("en.jsonl.gz"), "en", {
      each(o, entry) {
        for (const [lang, dicts] of Object.entries(TRANSLATIONS)) {
          // translations: on the entry (with a `sense` label) or on individual senses
          const isLang = isTranslationIn(lang);
          const byGloss = new Map<string, Sense>();
          const add = (gloss: string, t: any) => {
            let s = byGloss.get(gloss);
            if (!s) byGloss.set(gloss, (s = { gloss, translations: [] }));
            if (!s.translations!.some((x) => x.word === t.word && x.alt === t.alt)) s.translations!.push(translation(t, lang));
          };
          for (const s of o.senses ?? []) for (const t of (s.translations ?? []).filter(isLang)) add(t.sense ?? s.glosses?.at(-1) ?? "", t);
          for (const t of (o.translations ?? []).filter(isLang)) add(t.sense ?? "", t);
          const senses = [...byGloss.values()];
          if (!senses.length) continue;
          addEntry(dicts.translations, compact({ word: o.word, pos: o.pos, etym: entry.etym, senses }));
          for (const s of senses)
            for (const t of s.translations!) {
              addBacklink(dicts.backlinks, t.word, { word: o.word, lang: "en", pos: o.pos, sense: s.gloss });
              counts[lang] = (counts[lang] ?? 0) + 1;
            }
        }
      },
    });
    const others: string[] = [];
    for (const e of ENTRIES) if (exists(e.file)) others.push(`${await loadWiktionary(e.dict, raw(e.file), e.lang)} ${e.name}`);
    return `${english} english entries, translations ${JSON.stringify(counts)}, entries: ${others.join(", ")}`;
  },
} satisfies Source;
