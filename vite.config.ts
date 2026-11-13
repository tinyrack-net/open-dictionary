import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

// The dictionary data (~800 MB, ~6k files) lives in data/site instead of public/
// so Vite doesn't copy it on every build. The app reads it from /data/<version>/
// (app/lib/dataVersion.ts); scripts/postbuild.ts copies it into build/client/data/<version>/.
const DATA_ROOT = path.resolve("data/site");

/** Content hash written by scripts/build-data.ts; "dev" when the data hasn't been built. */
function dataVersion(): string {
  try {
    return fs.readFileSync(path.join(DATA_ROOT, "version.txt"), "utf8").trim() || "dev";
  } catch {
    return "dev";
  }
}

function dictionaryData(version: string): Plugin {
  return {
    name: "dictionary-data",
    configureServer(server) {
      // dev server: /data/version.txt and /data/<version>/<file> -> data/site/<file>
      server.middlewares.use("/data", (req, res, next) => {
        let rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const prefix = `/${version}/`;
        if (rel.startsWith(prefix)) rel = "/" + rel.slice(prefix.length);
        else if (rel !== "/version.txt") {
          res.statusCode = 404;
          return res.end();
        }
        const file = path.join(DATA_ROOT, rel);
        if (!file.startsWith(DATA_ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader("content-type", rel.endsWith(".json") ? "application/json" : "text/plain");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(() => {
  const version = dataVersion();
  return {
    plugins: [dictionaryData(version), tailwindcss(), reactRouter()],
    define: { "import.meta.env.VITE_DATA_VERSION": JSON.stringify(version) },
    resolve: {
      tsconfigPaths: true,
    },
  };
});
