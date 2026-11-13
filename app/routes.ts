import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // "/" picks a UI language (saved choice or browser language) and redirects
  index("routes/redirect.tsx"),
  route(":lang", "routes/lang.tsx", [
    index("routes/home.tsx"),
    // /{lang}/word?word=<headword>&dicts=<slugs>
    route("word", "routes/word.tsx"),
    // links from the first release: /{lang}/word/<headword> -> /{lang}/word?word=<headword>
    route("word/:word", "routes/legacy-word.tsx"),
    route("about", "routes/about.tsx"),
    // saved words: personal list kept in this browser (localStorage)
    route("saved", "routes/saved.tsx"),
  ]),
] satisfies RouteConfig;
