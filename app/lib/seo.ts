import { LANGS } from "./i18n";

/** Public origin, e.g. https://dictionary.example.com. Set VITE_SITE_URL at build time. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");

/** <link rel="alternate" hreflang> tags for a language-independent path ("" or "/word/x"). */
export function alternates(rest: string) {
  if (!SITE_URL) return []; // hreflang requires absolute URLs
  return [
    ...LANGS.map((l) => ({ tagName: "link", rel: "alternate", hrefLang: l, href: `${SITE_URL}/${l}${rest}` })),
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/en${rest}` },
  ];
}
