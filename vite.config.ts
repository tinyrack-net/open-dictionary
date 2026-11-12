import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

// The dictionary data (~550 MB, ~20k files) lives in data/site instead of public/
// so Vite doesn't copy it on every build. In dev it is served from /data/*;
// scripts/postbuild.ts copies it into build/client/data.
function dictionaryData(): Plugin {
  const root = path.resolve("data/site");
  return {
    name: "dictionary-data",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const file = path.join(root, decodeURIComponent((req.url ?? "/").split("?")[0]));
        if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader("content-type", "application/json");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [dictionaryData(), tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
