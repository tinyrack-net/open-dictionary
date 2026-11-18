import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // "/" picks a UI language from the browser and redirects
  index("routes/redirect.tsx"),
  route(":lang", "routes/lang.tsx", [
    index("routes/home.tsx"),
    // /{lang}/word?word=<headword>&dicts=<dictionary ids>
    route("word", "routes/word.tsx"),
    route("about", "routes/about.tsx"),
    // saved words: personal list kept in this browser (localStorage)
    route("saved", "routes/saved.tsx"),
  ]),
] satisfies RouteConfig;
