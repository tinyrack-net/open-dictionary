// Korean Wiktionary (kaikki.org, CC BY-SA 4.0): its English entries, defined in Korean
// -> "en-ko-kowiktionary".
//
// Same extractor and format as the English edition. Its relation lists label the sense they belong
// to with `sense`, which the converter doesn't read; they are kept on the entry, as the source lists
// them.
import { download, exists, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";
import { loadWiktionary } from "../lib/wiktextract.ts";

export default {
  name: "Korean Wiktionary (English entries)",
  dictionaries: ["en-ko-kowiktionary"],
  fetch() {
    download("kowikt-en.jsonl.gz", "https://kaikki.org/kowiktionary/%EC%98%81%EC%96%B4/kaikki.org-dictionary-%EC%98%81%EC%96%B4.jsonl", { gzip: true });
  },
  async build() {
    if (!exists("kowikt-en.jsonl.gz")) return "skipped (raw/kowikt-en.jsonl.gz missing)";
    return `${await loadWiktionary("en-ko-kowiktionary", raw("kowikt-en.jsonl.gz"), "en")} entries`;
  },
} satisfies Source;
