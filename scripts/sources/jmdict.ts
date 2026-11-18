// JMdict (Electronic Dictionary Research and Development Group, CC BY-SA 4.0), English edition, via
// jmdict-simplified (JSON) -> "jmdict".
//
// JMdict entries are word-level: several kanji and kana spellings, then senses, each restricted to
// some spellings (appliesToKanji / appliesToKana, "*" = all). One neutral entry is made per spelling
// that has at least one sense, so 食べる and たべる each find it; its senses are those that apply to
// that spelling, in source order. The other spellings are listed as alternative spellings (`alt`) and
// the readings as pronunciations. JMdict's codes (v1, vt, uk…) are spelled out with the dictionary's
// own tag descriptions. Example sentences (from Tatoeba, chosen by JMdict) are kept per sense.
//
// Attribution (EDRDG licence): acknowledged on every page that shows JMdict data, through the card's
// source line, which links to the project.
import fs from "node:fs";
import type { DictEntry, Example, Pron, Relations, Sense } from "../../app/lib/types.ts";
import { addEntry, compact, download, exists, extract, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";

const ID = "jmdict";
const RELEASES = "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest";

export default {
  name: "JMdict",
  dictionaries: [ID],
  async fetch() {
    if (exists("jmdict")) return;
    if (!exists("jmdict.tgz")) {
      // the release name changes with every update; take the English edition with examples
      const release = await (await fetch(RELEASES)).json();
      const asset = release.assets?.find((a: any) => /^jmdict-examples-eng-.*\.json\.tgz$/.test(a.name));
      if (!asset) throw new Error("jmdict: jmdict-examples-eng asset not found in the latest jmdict-simplified release");
      download("jmdict.tgz", asset.browser_download_url);
    }
    extract("jmdict.tgz", "jmdict");
  },
  build() {
    if (!exists("jmdict")) return "skipped (raw/jmdict missing)";
    const file = fs.readdirSync(raw("jmdict")).find((f) => f.endsWith(".json"));
    if (!file) return "skipped (no JSON in raw/jmdict)";
    const data = JSON.parse(fs.readFileSync(raw("jmdict", file), "utf8"));
    const tags: Record<string, string> = data.tags ?? {};
    const tag = (t: string) => tags[t] ?? t;
    let count = 0;
    for (const w of data.words) {
      const kanji: { text: string }[] = w.kanji ?? [];
      const kana: { text: string; appliesToKanji: string[] }[] = w.kana ?? [];
      const spellings = [...kanji.map((k) => ({ text: k.text, kanji: true })), ...kana.map((k) => ({ text: k.text, kanji: false }))];
      for (const sp of spellings) {
        const applies = (s: any) => (sp.kanji ? s.appliesToKanji.includes("*") || s.appliesToKanji.includes(sp.text) : s.appliesToKana.includes("*") || s.appliesToKana.includes(sp.text));
        const senses: Sense[] = w.sense.filter(applies).map(
          (s: any): Sense =>
            compact({
              gloss: s.gloss.map((g: any) => g.text).join("; "),
              tags: [...s.partOfSpeech, ...s.misc, ...s.field, ...s.dialect].map(tag),
              notes: s.info,
              examples: (s.examples ?? []).map((x: any): Example => {
                const ja = x.sentences.find((t: any) => t.lang === "jpn")?.text ?? x.text;
                const en = x.sentences.find((t: any) => t.lang === "eng")?.text;
                return compact({ text: ja, translation: en });
              }),
              relations: compact({
                related: s.related.map((r: any[]) => ({ word: String(r[0]) })),
                antonyms: s.antonym.map((r: any[]) => ({ word: String(r[0]) })),
              } as Relations),
            }),
        );
        if (!senses.length) continue;
        // readings that apply to this spelling (for a kana spelling: itself, so none are listed)
        const readings = sp.kanji ? kana.filter((k) => k.appliesToKanji.includes("*") || k.appliesToKanji.includes(sp.text)).map((k) => k.text) : [];
        const entry: DictEntry = compact({
          word: sp.text,
          pos: w.sense.find(applies)?.partOfSpeech.map(tag)[0] ?? "",
          alt: spellings.filter((x) => x.text !== sp.text).map((x) => x.text),
          pron: readings.map((text): Pron => ({ text, kind: "reading" })),
          senses,
        });
        addEntry(ID, entry);
        count++;
      }
    }
    return `${data.words.length} words, ${count} spelling entries (JMdict ${data.dictDate})`;
  },
} satisfies Source;
