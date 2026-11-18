import type { Config } from "@react-router/dev/config";
import { LANGS } from "./app/lib/dicts.ts";

// Static site: only a handful of pages are prerendered. Word pages share one HTML shell per
// UI language (/{lang}/word?word=...) and load their data in the browser from /data chunks.
// Any other path (e.g. "/") gets the SPA fallback index.html.

export default {
  ssr: false,
  prerender: LANGS.flatMap((l) => [`/${l}`, `/${l}/word`, `/${l}/about`, `/${l}/saved`]),
} satisfies Config;
