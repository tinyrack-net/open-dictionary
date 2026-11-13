// Downloads the raw sources into ./raw (≈ 600 MB compressed):
//   Wiktionary (kaikki.org), Open English WordNet, Tatoeba English–Korean sentences, and the
//   wordfreq frequency lists (exported to raw/wordfreq.json with uv + Python).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RAW = path.resolve(import.meta.dirname, "..", "raw");
fs.mkdirSync(RAW, { recursive: true });

const files = [
  // kaikki.org serves gzip when asked; the compressed stream is stored as-is
  { out: "en.jsonl.gz", url: "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl", gzip: true },
  { out: "ko.jsonl.gz", url: "https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl", gzip: true },
  { out: "oewn.zip", url: "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip" },
  // Tatoeba (CC BY 2.0 FR): English–Korean links + the sentences on both sides
  { out: "tatoeba/eng-kor_links.tsv.bz2", url: "https://downloads.tatoeba.org/exports/per_language/eng/eng-kor_links.tsv.bz2" },
  { out: "tatoeba/kor_sentences.tsv.bz2", url: "https://downloads.tatoeba.org/exports/per_language/kor/kor_sentences.tsv.bz2" },
  { out: "tatoeba/eng_sentences.tsv.bz2", url: "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2" },
];
fs.mkdirSync(path.join(RAW, "tatoeba"), { recursive: true });

for (const f of files) {
  const dest = path.join(RAW, f.out);
  if (fs.existsSync(dest)) {
    console.log(`skip ${f.out} (exists)`);
    continue;
  }
  console.log(`downloading ${f.url}`);
  const args = ["-fsSL", "--retry", "5", "--retry-all-errors", "-o", dest + ".part", f.url];
  if (f.gzip) args.unshift("-H", "Accept-Encoding: gzip");
  execFileSync("curl", args, { stdio: "inherit" });
  fs.renameSync(dest + ".part", dest);
}

const oewn = path.join(RAW, "oewn");
if (!fs.existsSync(oewn)) {
  fs.mkdirSync(oewn);
  const zip = path.join(RAW, "oewn.zip");
  // GNU tar (Linux) can't read zip; Windows ships bsdtar but not unzip
  if (process.platform === "win32") execFileSync("tar", ["-xf", zip, "-C", oewn], { stdio: "inherit" });
  else execFileSync("unzip", ["-oq", zip, "-d", oewn], { stdio: "inherit" });
}
// Tatoeba ships bzip2; build-data reads plain TSV
for (const f of files.filter((f) => f.out.endsWith(".bz2"))) {
  const tsv = path.join(RAW, f.out.replace(/\.bz2$/, ""));
  if (!fs.existsSync(tsv)) execFileSync("bunzip2", ["-kf", path.join(RAW, f.out)], { stdio: "inherit" });
}

// wordfreq (CC BY-SA 4.0 data): export the English and Korean Zipf frequencies to JSON.
// Needs uv; skipped (with a warning) when unavailable, since frequency is optional.
const freqFile = path.join(RAW, "wordfreq.json");
if (!fs.existsSync(freqFile)) {
  const py = `
import gzip, json, os, msgpack, wordfreq
d = os.path.join(os.path.dirname(wordfreq.__file__), "data")
out = {}
for lang, f in [("en", "large_en.msgpack.gz"), ("ko", "small_ko.msgpack.gz")]:
    buckets = msgpack.unpackb(gzip.open(os.path.join(d, f)).read(), raw=False)
    # bucket i holds words with frequency 10^(-i/100); Zipf = 9 - i/100
    out[lang] = {w: round(9 - i / 100, 2) for i, b in enumerate(buckets[1:], 1) for w in b}
json.dump(out, open(${JSON.stringify(freqFile)}, "w", encoding="utf-8"), ensure_ascii=False)
`;
  try {
    execFileSync("uv", ["run", "--no-project", "--with", "wordfreq==3.1.1", "--with", "msgpack", "python", "-c", py], { stdio: "inherit" });
  } catch {
    console.warn("wordfreq: export failed (is uv installed?); frequency stars will be missing");
  }
}
console.log("done");
