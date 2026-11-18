// Downloads every source's raw files into raw/ (≈ 700 MB compressed). Files that are already there
// are kept; delete them to refresh. Each source module knows its own URLs (scripts/sources/).
import fs from "node:fs";
import { RAW } from "./lib/core.ts";
import { SOURCES } from "./sources/index.ts";

fs.mkdirSync(RAW, { recursive: true });
for (const s of SOURCES) {
  console.log(s.name);
  await s.fetch();
}
console.log("done");
