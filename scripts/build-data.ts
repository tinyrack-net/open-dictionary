// Converts the raw sources (raw/, from `pnpm fetch-data`) into the static data the site serves
// (data/site/, see scripts/lib/output.ts). Each source module converts its own format into the
// neutral format of app/lib/types.ts; this script only runs them in order and writes the result.
//
// Run: pnpm build-data            (LIMIT=50000 pnpm build-data reads fewer lines per JSONL file)
import { dictById } from "../app/lib/dicts.ts";
import { writeSite } from "./lib/output.ts";
import { SOURCES } from "./sources/index.ts";

const t0 = Date.now();
for (const s of SOURCES)
  for (const id of s.dictionaries) if (!dictById.has(id)) throw new Error(`${s.name}: dictionary "${id}" is not in DICTIONARIES (app/lib/dicts.ts)`);

for (const s of SOURCES) console.log(`${s.name}: ${await s.build()}`);
for (const s of SOURCES) if (s.after) console.log(`${s.name}: ${await s.after()}`);
console.log("writing data/site");
const version = writeSite();
console.log(`data version ${version}, done in ${((Date.now() - t0) / 1000).toFixed(0)}s, peak RSS ${(process.resourceUsage().maxRSS / 1024 / 1024).toFixed(1)} GB`);
