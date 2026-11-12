import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("word/:word", "routes/word.tsx"),
    route("about", "routes/about.tsx"),
  ]),
] satisfies RouteConfig;
