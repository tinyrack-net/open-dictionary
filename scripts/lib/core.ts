// Shared by every source module (scripts/sources/*.ts): where raw data lives, how headwords are
// collected, and small helpers for the neutral format (app/lib/types.ts).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { entryKey } from "../../app/lib/keys.ts";
import type { Backlink, DictEntry, DictPart, SentencePair } from "../../app/lib/types.ts";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const RAW = path.join(ROOT, "raw");
/** Lines per JSONL file to read (development: LIMIT=50000 pnpm build-data). */
export const LIMIT = Number(process.env.LIMIT ?? Infinity);

// ---------------------------------------------------------------- collected headwords

/** One headword: its display spelling, optional frequency, and what each dictionary has for it. */
export interface Headword {
  w: string;
  /** Zipf frequency, search ranking only */
  freq?: number;
  parts: Record<string, DictPart>;
}

/** Every headword of every source, by entryKey. Sources add to it; the build writes it out. */
export const headwords = new Map<string, Headword>();

/** The headword for a spelling, created on first use. The first spelling seen is displayed. */
export function headword(display: string): Headword {
  const key = entryKey(display);
  let h = headwords.get(key);
  if (!h) headwords.set(key, (h = { w: display, parts: {} }));
  return h;
}

/** What dictionary `id` has for a headword, created on first use. */
export function partOf(display: string, id: string): DictPart {
  return (headword(display).parts[id] ??= {});
}

export function addEntry(id: string, entry: DictEntry) {
  (partOf(entry.word, id).entries ??= []).push(entry);
}

/** Adds a backlink unless the same one (word, part of speech, sense) is already there. */
export function addBacklink(id: string, target: string, link: Backlink): boolean {
  const list = (partOf(target, id).backlinks ??= []);
  if (list.some((b) => b.word === link.word && b.pos === link.pos && b.sense === link.sense)) return false;
  list.push(link);
  return true;
}

/** Adds a sentence pair to an existing headword (pairs never create headwords). */
export function addPair(id: string, key: string, pair: SentencePair): boolean {
  const h = headwords.get(key);
  if (!h) return false;
  const list = ((h.parts[id] ??= {}).pairs ??= []);
  if (list.includes(pair)) return false;
  list.push(pair);
  return true;
}

// ---------------------------------------------------------------- neutral-format helpers

/** Drops undefined values and empty arrays/objects so the stored JSON stays lean. */
export function compact<T extends object>(o: T): T {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0))
      delete (o as Record<string, unknown>)[k];
  }
  return o;
}

export const strs = (xs: unknown): string[] | undefined => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string" && x !== "") : undefined);

/** A value or a list of them, as a list (formats that write one item without the array). */
export const list = <T>(x: T | T[] | undefined | null): T[] => (Array.isArray(x) ? x : x == null ? [] : [x]);

// ---------------------------------------------------------------- reading raw files

export const raw = (...p: string[]) => path.join(RAW, ...p);
export const exists = (...p: string[]) => fs.existsSync(raw(...p));

/** Lines of a gzipped JSONL file, parsed, up to LIMIT. */
export async function* jsonl(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (++n > LIMIT) break;
    if (n % 200000 === 0) console.log(`  ${path.basename(file)}: ${n} lines`);
    yield JSON.parse(line);
  }
}

// ---------------------------------------------------------------- downloading

/**
 * Downloads a URL into raw/<out> unless it is there already (delete it to refresh). `gzip` stores
 * the compressed stream as-is (kaikki.org serves gzip when asked).
 */
export function download(out: string, url: string, opts: { gzip?: boolean; userAgent?: string } = {}) {
  const dest = raw(out);
  if (fs.existsSync(dest)) return console.log(`  skip ${out} (exists)`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  console.log(`  downloading ${url}`);
  const args = ["-fsSL", "--retry", "5", "--retry-all-errors", "-o", dest + ".part", url];
  if (opts.gzip) args.unshift("-H", "Accept-Encoding: gzip");
  if (opts.userAgent) args.unshift("-A", opts.userAgent);
  execFileSync("curl", args, { stdio: "inherit" });
  fs.renameSync(dest + ".part", dest);
}

/** Extracts a zip into raw/<dir> once. */
export function unzip(zip: string, dir: string) {
  const dest = raw(dir);
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(dest + ".part", { recursive: true });
  // GNU tar (Linux) can't read zip; Windows ships bsdtar but not unzip
  if (process.platform === "win32") execFileSync("tar", ["-xf", raw(zip), "-C", dest + ".part"], { stdio: "inherit" });
  else execFileSync("unzip", ["-oq", raw(zip), "-d", dest + ".part"], { stdio: "inherit" });
  fs.renameSync(dest + ".part", dest);
}

/** Decompresses raw/<file>.bz2 next to itself once. */
export function bunzip(file: string) {
  if (!fs.existsSync(raw(file.replace(/\.bz2$/, "")))) execFileSync("bunzip2", ["-kf", raw(file)], { stdio: "inherit" });
}
