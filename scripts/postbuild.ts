// Prepares build/client for Cloudflare Workers static assets.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT = path.join(ROOT, "build", "client");
const FILE_LIMIT = 20_000; // Workers free plan, files per version

// 1. Copy dictionary data next to the app, under its content version (app/lib/dataVersion.ts):
//    build/client/data/version.txt          deployed version (revalidated on every request)
//    build/client/data/<version>/...        the data, cached forever (public/_headers)
const t0 = Date.now();
const SITE = path.join(ROOT, "data", "site");
const version = fs.readFileSync(path.join(SITE, "version.txt"), "utf8").trim();
if (!/^[0-9a-f]{12}$/.test(version)) throw new Error(`postbuild: bad data version "${version}" (rerun pnpm build-data)`);
const DATA = path.join(CLIENT, "data");
fs.rmSync(DATA, { recursive: true, force: true });
for (const e of fs.readdirSync(SITE)) {
  if (e === "version.txt") continue;
  fs.cpSync(path.join(SITE, e), path.join(DATA, version, e), { recursive: true });
}
fs.writeFileSync(path.join(DATA, "version.txt"), version);
// the app must have been built against the same data version
const bundles = fs.readdirSync(path.join(CLIENT, "assets")).filter((f) => f.endsWith(".js"));
if (!bundles.some((f) => fs.readFileSync(path.join(CLIENT, "assets", f), "utf8").includes(version)))
  throw new Error(`postbuild: the app bundle doesn't reference data version ${version}; rebuild the app`);
console.log(`postbuild: copied data/site -> build/client/data/${version} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// 2. Service worker (PWA): scripts/sw.template.js with this build's precache list and versions.
//    Precached: every prerendered page and its .data file, the app's JS and CSS, and the icons. Fonts
//    (~280 unicode-range files) and dictionary data are cached on first use instead.
{
  const list = (dir: string, base = ""): string[] =>
    fs.readdirSync(path.join(CLIENT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = `${base}/${e.name}`;
      if (e.isDirectory()) return rel === "/data" ? [] : list(path.join(dir, e.name), rel);
      return [rel];
    });
  const files = list("");
  // pages by the clean URL the host serves them at (/en/word/index.html -> /en/word, /index.html -> /)
  const pages = files.filter((f) => f.endsWith("/index.html")).map((f) => f.slice(0, -"/index.html".length) || "/");
  const precache = [
    ...pages,
    ...files.filter((f) => f.endsWith(".data") || /^\/assets\/.*\.(js|css)$/.test(f) || f.startsWith("/icons/") || f === "/manifest.webmanifest" || f === "/favicon.svg"),
  ];
  const build = crypto.createHash("sha256").update(version).update(precache.join("\n")).update(bundles.join("\n")).digest("hex").slice(0, 12);
  const sw = fs
    .readFileSync(path.join(ROOT, "scripts", "sw.template.js"), "utf8")
    .replace("__BUILD__", build)
    .replace("__DATA_VERSION__", version)
    .replace("__PRECACHE__", JSON.stringify(precache));
  fs.writeFileSync(path.join(CLIENT, "sw.js"), sw);
  console.log(`postbuild: sw.js (build ${build}) precaches ${precache.length} files`);
}

// 3. Report the static asset budget per top-level directory.
const usage = new Map<string, { files: number; bytes: number }>();
let largest = 0;
// group by first path segment, or two segments under data/ (e.g. data/d, data/i)
const areaOf = (rel: string) => {
  const parts = rel.split(path.sep);
  if (parts.length === 1) return "(root)";
  return parts[0] === "data" && parts.length > 2 ? `data/${parts[1]}` : parts[0];
};
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    const size = fs.statSync(p).size;
    largest = Math.max(largest, size);
    const a = areaOf(path.relative(CLIENT, p));
    const u = usage.get(a) ?? { files: 0, bytes: 0 };
    u.files++;
    u.bytes += size;
    usage.set(a, u);
  }
};
walk(CLIENT);
let files = 0;
for (const [area, u] of [...usage].sort()) {
  files += u.files;
  console.log(`  ${area.padEnd(10)} ${String(u.files).padStart(6)} files ${(u.bytes / 1e6).toFixed(1).padStart(7)} MB`);
}
console.log(`postbuild: ${files} files, largest ${(largest / 1024).toFixed(0)} KiB (limit ${FILE_LIMIT} files, 25 MiB each)`);
if (files > FILE_LIMIT) {
  console.error("postbuild: too many files for the Workers free plan");
  process.exit(1);
}
