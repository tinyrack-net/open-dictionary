// Downloads the raw sources into ./raw (≈ 600 MB compressed).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RAW = path.resolve(import.meta.dirname, "..", "raw");
fs.mkdirSync(RAW, { recursive: true });

const files = [
  // kaikki.org serves gzip when asked; we store the compressed stream as-is
  { out: "en.jsonl.gz", url: "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl", gzip: true },
  { out: "ko.jsonl.gz", url: "https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl", gzip: true },
  { out: "oewn.zip", url: "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip" },
];

for (const f of files) {
  const dest = path.join(RAW, f.out);
  if (fs.existsSync(dest)) {
    console.log(`skip ${f.out} (exists)`);
    continue;
  }
  console.log(`downloading ${f.url}`);
  const args = ["-fL", "--retry", "3", "-o", dest + ".part", f.url];
  if (f.gzip) args.unshift("-H", "Accept-Encoding: gzip");
  execFileSync("curl", args, { stdio: "inherit" });
  fs.renameSync(dest + ".part", dest);
}

const oewn = path.join(RAW, "oewn");
if (!fs.existsSync(oewn)) {
  fs.mkdirSync(oewn);
  execFileSync("tar", ["-xf", path.join(RAW, "oewn.zip"), "-C", oewn], { stdio: "inherit" });
}
console.log("done");
