// Japanese Wiktionary (kaikki.org, CC BY-SA 4.0): its Japanese entries, defined in Japanese -> "ja-wiktionary".
//
// Same extractor and format as the other editions. This edition keeps headwords in kana and gives the
// kanji spelling as a form tagged "kanji" (たべる: 食べる); those are alternative spellings, stored in
// `alt`, as the source lists them. Kanji spellings that have their own page are entries of their own.
// Sense labels that this edition keeps in `raw_tags` are added to the sense's tags verbatim.
import { download, exists, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";
import { loadWiktionary } from "../lib/wiktextract.ts";

export default {
  name: "Japanese Wiktionary",
  dictionaries: ["ja-wiktionary"],
  fetch() {
    download("jawikt-ja.jsonl.gz", "https://kaikki.org/jawiktionary/%E6%97%A5%E6%9C%AC%E8%AA%9E/kaikki.org-dictionary-%E6%97%A5%E6%9C%AC%E8%AA%9E.jsonl", { gzip: true });
  },
  async build() {
    if (!exists("jawikt-ja.jsonl.gz")) return "skipped (raw/jawikt-ja.jsonl.gz missing)";
    const n = await loadWiktionary("ja-wiktionary", raw("jawikt-ja.jsonl.gz"), "ja", {
      altTags: ["kanji"],
      prepare: (o) => ({ ...o, senses: (o.senses ?? []).map((s: any) => ({ ...s, tags: [...(s.tags ?? []), ...(s.raw_tags ?? [])] })) }),
    });
    return `${n} entries`;
  },
} satisfies Source;
