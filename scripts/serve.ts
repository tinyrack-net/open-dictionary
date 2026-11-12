// Minimal static server mimicking Cloudflare Pages / nginx `try_files $uri $uri/index.html /__spa-fallback.html`.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "build", "client");
const PORT = Number(process.env.PORT ?? 4173);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".data": "text/x-script",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    const candidates = [url, path.join(url, "index.html"), "/__spa-fallback.html"];
    for (const c of candidates) {
      const file = path.join(ROOT, c);
      if (!file.startsWith(ROOT)) break;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const fallback = c === "/__spa-fallback.html" && url.startsWith("/data/");
        if (fallback) break; // missing data files must 404, not return HTML
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404).end("not found");
  })
  .listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
