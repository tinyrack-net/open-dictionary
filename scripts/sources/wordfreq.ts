// wordfreq 3.1 (CC BY-SA 4.0 data): word frequencies, used only to rank search suggestions (never
// shown, not a dictionary). Exported to raw/wordfreq.json with uv + Python.
//
// To rank another language, add it to LANGS (a wordfreq list name) with a test for its script.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { headwords, raw } from "../lib/core.ts";
import type { Source } from "../lib/source.ts";

/** wordfreq list per language, and how to tell a headword is in that language. */
const LANGS: { lang: string; list: string; test: (key: string) => boolean }[] = [
  { lang: "ko", list: "small_ko", test: (k) => /[\uac00-\ud7af]/.test(k) },
  // kana or CJK ideographs (kanji): Japanese; CJK-only words that are Korean hanja forms are rare as keys
  { lang: "ja", list: "large_ja", test: (k) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(k) },
  { lang: "en", list: "large_en", test: () => true },
];

export default {
  name: "wordfreq",
  dictionaries: [],
  fetch() {
    const file = raw("wordfreq.json");
    if (fs.existsSync(file)) return;
    const py = `
import gzip, json, os, msgpack, wordfreq
d = os.path.join(os.path.dirname(wordfreq.__file__), "data")
out = {}
for lang, f in ${JSON.stringify(LANGS.map((l) => [l.lang, `${l.list}.msgpack.gz`]))}:
    buckets = msgpack.unpackb(gzip.open(os.path.join(d, f)).read(), raw=False)
    # bucket i holds words with frequency 10^(-i/100); Zipf = 9 - i/100
    out[lang] = {w: round(9 - i / 100, 2) for i, b in enumerate(buckets[1:], 1) for w in b}
json.dump(out, open(${JSON.stringify(file)}, "w", encoding="utf-8"), ensure_ascii=False)
`;
    try {
      execFileSync("uv", ["run", "--no-project", "--with", "wordfreq==3.1.1", "--with", "msgpack", "python", "-c", py], { stdio: "inherit" });
    } catch {
      console.warn("  wordfreq: export failed (is uv installed?); search ranking will ignore frequency");
    }
  },
  build: () => "applied after the dictionaries",
  after() {
    const file = raw("wordfreq.json");
    if (!fs.existsSync(file)) return "skipped (raw/wordfreq.json missing)";
    const freq: Record<string, Record<string, number>> = JSON.parse(fs.readFileSync(file, "utf8"));
    let n = 0;
    for (const [key, h] of headwords) {
      const lang = LANGS.find((l) => l.test(key))!.lang;
      const f = freq[lang]?.[key];
      if (f) {
        h.freq = f;
        n++;
      }
    }
    return `${n} headwords with a frequency (search ranking only)`;
  },
} satisfies Source;
