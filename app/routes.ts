import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // "/" picks a UI language (saved choice or browser language) and redirects
  index("routes/redirect.tsx"),
  route(":lang", "routes/lang.tsx", [
    index("routes/home.tsx"),
    route("word/:word", "routes/word.tsx"),
    route("about", "routes/about.tsx"),
  ]),
] satisfies RouteConfig;
