import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT = path.join(ROOT, "build", "client");

// 1. React Router writes prerendered paths percent-encoded (word/%EC%82%AC%EB%9E%91/index.html).
//    Static hosts decode the URL before mapping it to a file, so rename to UTF-8 (word/사랑/index.html).
const words = path.join(CLIENT, "word");
let renamed = 0;
for (const name of fs.existsSync(words) ? fs.readdirSync(words) : []) {
  const decoded = decodeURIComponent(name);
  if (decoded !== name) {
    fs.renameSync(path.join(words, name), path.join(words, decoded));
    renamed++;
  }
}
console.log(`postbuild: decoded ${renamed} prerendered paths`);

// 2. Copy dictionary data next to the app.
const t0 = Date.now();
fs.cpSync(path.join(ROOT, "data", "site"), path.join(CLIENT, "data"), { recursive: true });
console.log(`postbuild: copied data/site -> build/client/data in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
