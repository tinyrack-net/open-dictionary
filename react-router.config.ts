import type { Config } from "@react-router/dev/config";

// Static site: only a handful of pages are prerendered. Word pages share one HTML shell per
// UI language (/{lang}/word?word=...) and load their data in the browser from /data chunks.
// Any other path (e.g. "/", old /{lang}/word/<headword> links) gets the SPA fallback index.html.
const LANGS = ["en", "ko"];

export default {
  ssr: false,
  prerender: LANGS.flatMap((l) => [`/${l}`, `/${l}/word`, `/${l}/about`]),
} satisfies Config;
