// Prepares build/client for Cloudflare Workers static assets.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT = path.join(ROOT, "build", "client");
const FILE_LIMIT = 20_000; // Workers free plan, files per version

// 1. React Router writes prerendered paths percent-encoded (ko/word/%EC%82%AC%EB%9E%91/index.html).
//    Static hosts decode the URL before mapping it to a file, so rename to UTF-8 (ko/word/사랑/index.html).
let renamed = 0;
for (const lang of fs.readdirSync(CLIENT)) {
  const dir = path.join(CLIENT, lang, "word");
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    const decoded = decodeURIComponent(name);
    if (decoded !== name) {
      fs.renameSync(path.join(dir, name), path.join(dir, decoded));
      renamed++;
    }
  }
}
console.log(`postbuild: decoded ${renamed} prerendered paths`);

// 2. Copy dictionary data next to the app.
const t0 = Date.now();
fs.cpSync(path.join(ROOT, "data", "site"), path.join(CLIENT, "data"), { recursive: true });
console.log(`postbuild: copied data/site -> build/client/data in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// 3. Check the static asset budget.
let files = 0;
let largest = 0;
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      files++;
      largest = Math.max(largest, fs.statSync(p).size);
    }
  }
};
walk(CLIENT);
console.log(`postbuild: ${files} files, largest ${(largest / 1024).toFixed(0)} KiB (limit ${FILE_LIMIT} files, 25 MiB each)`);
if (files > FILE_LIMIT) {
  console.error(`postbuild: too many files for the Workers free plan; lower PRERENDER_LIMIT`);
  process.exit(1);
}
