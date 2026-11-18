// Korean Wiktionary (kaikki.org, CC BY-SA 4.0): entries of other languages, defined in Korean.
//   "en-ko-kowiktionary"  English entries
//   "ja-ko-kowiktionary"  Japanese entries
//
// Same extractor and format as the English edition. Its relation lists label the sense they belong
// to with `sense`, which the converter doesn't read; they are kept on the entry, as the source lists
// them.
import { download, exists, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";
import { loadWiktionary } from "../lib/wiktextract.ts";

/** Language -> kaikki.org page name (in Korean) and dictionary. */
const EDITIONS: { lang: string; page: string; file: string; dict: string }[] = [
  { lang: "en", page: "영어", file: "kowikt-en.jsonl.gz", dict: "en-ko-kowiktionary" },
  { lang: "ja", page: "일본어", file: "kowikt-ja.jsonl.gz", dict: "ja-ko-kowiktionary" },
];

export default {
  name: "Korean Wiktionary",
  dictionaries: EDITIONS.map((e) => e.dict),
  fetch() {
    for (const e of EDITIONS) {
      const page = encodeURIComponent(e.page);
      download(e.file, `https://kaikki.org/kowiktionary/${page}/kaikki.org-dictionary-${page}.jsonl`, { gzip: true });
    }
  },
  async build() {
    const out: string[] = [];
    for (const e of EDITIONS) {
      if (!exists(e.file)) {
        out.push(`${e.lang}: skipped (raw/${e.file} missing)`);
        continue;
      }
      out.push(`${e.lang}: ${await loadWiktionary(e.dict, raw(e.file), e.lang)} entries`);
    }
    return out.join(", ");
  },
} satisfies Source;
