// Prepares build/client for Cloudflare Workers static assets.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT = path.join(ROOT, "build", "client");
const FILE_LIMIT = 20_000; // Workers free plan, files per version

// 1. Copy dictionary data next to the app.
const t0 = Date.now();
fs.cpSync(path.join(ROOT, "data", "site"), path.join(CLIENT, "data"), { recursive: true });
console.log(`postbuild: copied data/site -> build/client/data in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// 2. Report the static asset budget per top-level directory.
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
