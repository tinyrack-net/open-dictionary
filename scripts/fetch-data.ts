// Downloads the raw sources into ./raw (≈ 570 MB compressed).
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
];

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
console.log("done");
