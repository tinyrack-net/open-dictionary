// Simple English Wiktionary (kaikki.org, CC BY-SA 4.0) -> "simple-wiktionary".
//
// Learner's definitions in plain English. Same converter as the English edition, with one difference:
// this edition keeps its sense labels ("countable", "transitive & intransitive", "informal") in
// `raw_tags`, which are added to the sense's tags verbatim. Its sound entries name audio files but
// have no playable URL, so the entries carry no recordings.
import { download, exists, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";
import { loadWiktionary } from "../lib/wiktextract.ts";

export default {
  name: "Simple English Wiktionary",
  dictionaries: ["simple-wiktionary"],
  fetch() {
    download("simple.jsonl.gz", "https://kaikki.org/simplewiktionary/English/kaikki.org-dictionary-English.jsonl", { gzip: true });
  },
  async build() {
    if (!exists("simple.jsonl.gz")) return "skipped (raw/simple.jsonl.gz missing)";
    const n = await loadWiktionary("simple-wiktionary", raw("simple.jsonl.gz"), "en", {
      prepare: (o) => ({ ...o, senses: (o.senses ?? []).map((s: any) => ({ ...s, tags: [...(s.tags ?? []), ...(s.raw_tags ?? [])] })) }),
    });
    return `${n} entries`;
  },
} satisfies Source;
