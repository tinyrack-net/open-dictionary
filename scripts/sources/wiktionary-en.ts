// English Wiktionary (kaikki.org, CC BY-SA 4.0) -> three dictionaries:
//   "wiktionary"  English entries
//   "en-ko"       their Korean translations: one entry per English entry with the same headword and
//                 part of speech, whose senses carry only the translations (Wiktionary keeps them per
//                 sense); each Korean word also gets a backlink in "ko-en"
//   "ko-en"       Korean entries (English definitions) + those backlinks
import type { Sense } from "../../app/lib/types.ts";
import { addBacklink, addEntry, compact, download, exists, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";
import { isTranslationIn, loadWiktionary, translation } from "../lib/wiktextract.ts";

const isKo = isTranslationIn("ko");

export default {
  name: "English Wiktionary",
  dictionaries: ["wiktionary", "en-ko", "ko-en"],
  fetch() {
    download("en.jsonl.gz", "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl", { gzip: true });
    download("ko.jsonl.gz", "https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl", { gzip: true });
  },
  async build() {
    if (!exists("en.jsonl.gz")) return "skipped (raw/en.jsonl.gz missing)";
    let translations = 0;
    const english = await loadWiktionary("wiktionary", raw("en.jsonl.gz"), "en", {
      each(o, entry) {
        // Korean translations: on the entry (with a `sense` label) or on individual senses
        const byGloss = new Map<string, Sense>();
        const add = (gloss: string, t: any) => {
          let s = byGloss.get(gloss);
          if (!s) byGloss.set(gloss, (s = { gloss, translations: [] }));
          if (!s.translations!.some((x) => x.word === t.word && x.alt === t.alt)) s.translations!.push(translation(t, "ko"));
        };
        for (const s of o.senses ?? []) for (const t of (s.translations ?? []).filter(isKo)) add(t.sense ?? s.glosses?.at(-1) ?? "", t);
        for (const t of (o.translations ?? []).filter(isKo)) add(t.sense ?? "", t);
        const senses = [...byGloss.values()];
        if (!senses.length) return;
        addEntry("en-ko", compact({ word: o.word, pos: o.pos, etym: entry.etym, senses }));
        for (const s of senses)
          for (const t of s.translations!) {
            addBacklink("ko-en", t.word, { word: o.word, lang: "en", pos: o.pos, sense: s.gloss });
            translations++;
          }
      },
    });
    const korean = exists("ko.jsonl.gz") ? await loadWiktionary("ko-en", raw("ko.jsonl.gz"), "ko") : 0;
    return `${english} english entries, ${translations} korean translations, ${korean} korean entries`;
  },
} satisfies Source;
