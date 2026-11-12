import type { Config } from "@react-router/dev/config";
import fs from "node:fs";

// Pre-render the home/about pages and the most common headwords as static HTML.
// Every other word is served by the SPA fallback (__spa-fallback.html) and loaded
// in the browser from the sharded JSON under /data.
const words: string[] = fs.existsSync("data/prerender.json")
  ? JSON.parse(fs.readFileSync("data/prerender.json", "utf8"))
  : [];
const limit = Number(process.env.PRERENDER_LIMIT ?? words.length);

export default {
  ssr: false,
  prerender: {
    paths: ["/", "/about", ...words.slice(0, limit).map((w) => `/word/${w}`)],
    concurrency: 1,
  },
} satisfies Config;
