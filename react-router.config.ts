import type { Config } from "@react-router/dev/config";
import fs from "node:fs";

// Pre-render the language home/about pages and the most common headwords in every UI language.
// Every other word is served by the SPA fallback (build/client/index.html) and loaded in the
// browser from the sharded JSON under /data.
//
// File budget (Cloudflare Workers free plan: 20,000 static files per version):
//   data ≈ 4,700 files + 2 files (html + .data) × words × languages.
const LANGS = ["en", "ko"];
const words: string[] = fs.existsSync("data/prerender.json") ? JSON.parse(fs.readFileSync("data/prerender.json", "utf8")) : [];
const limit = Number(process.env.PRERENDER_LIMIT ?? words.length);

export default {
  ssr: false,
  prerender: {
    paths: LANGS.flatMap((l) => [`/${l}`, `/${l}/about`, ...words.slice(0, limit).map((w) => `/${l}/word/${w}`)]),
    // higher values time out on Windows (prerender requests have a fixed 10s timeout)
    concurrency: Number(process.env.PRERENDER_CONCURRENCY ?? 1),
  },
} satisfies Config;
