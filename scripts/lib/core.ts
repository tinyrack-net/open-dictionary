// Shared by every source module (scripts/sources/*.ts): where raw data lives, how headwords are
// collected, and small helpers for the neutral format (app/lib/types.ts).
//
// Memory: the full data is several GB as objects, so dictionary content is not kept in memory. Each
// add* call appends one small JSON line to a spool file per dictionary (data/spool/<id>.jsonl); the
// writer (output.ts) reads them back one dictionary at a time. In memory there is only one light
// record per headword: its display spelling, frequency and which dictionaries have it.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { entryKey } from "../../app/lib/keys.ts";
import type { Backlink, DictEntry, Sentence } from "../../app/lib/types.ts";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const RAW = path.join(ROOT, "raw");
export const SPOOL = path.join(ROOT, "data", "spool");
/** Lines per JSONL file to read (development: LIMIT=50000 pnpm build-data). */
export const LIMIT = Number(process.env.LIMIT ?? Infinity);

// ---------------------------------------------------------------- collected headwords

/** One headword: display spelling, optional frequency, and the dictionaries that have something for it. */
export interface Headword {
  w: string;
  /** Zipf frequency, search ranking only */
  freq?: number;
  dicts: Set<string>;
}

/** Every headword of every source, by entryKey. */
export const headwords = new Map<string, Headword>();

/** The headword for a spelling, created on first use. The first spelling seen is displayed. */
export function headword(display: string): Headword {
  const key = entryKey(display);
  let h = headwords.get(key);
  if (!h) headwords.set(key, (h = { w: display, dicts: new Set() }));
  return h;
}

// ---------------------------------------------------------------- spooled content

type Fragment = ["e", DictEntry] | ["b", Backlink] | ["s", number];
const spools = new Map<string, { fd: number; buf: string[]; size: number }>();

function spool(id: string, key: string, fragment: Fragment) {
  write(id, JSON.stringify([key, ...fragment]));
}

/** Appends a line to spool file `name` (buffered). */
function write(id: string, line: string) {
  let s = spools.get(id);
  if (!s) {
    fs.mkdirSync(SPOOL, { recursive: true });
    spools.set(id, (s = { fd: fs.openSync(path.join(SPOOL, `${id}.jsonl`), "w"), buf: [], size: 0 }));
  }
  s.buf.push(line);
  s.size += line.length;
  if (s.size > 4_000_000) flushSpool(id);
}

function flushSpool(id: string) {
  const s = spools.get(id)!;
  if (s.buf.length) fs.writeSync(s.fd, s.buf.join("\n") + "\n");
  s.buf = [];
  s.size = 0;
}

/** Closes every spool file; the writer reads them afterwards. */
export function closeSpools() {
  for (const [id, s] of spools) {
    flushSpool(id);
    fs.closeSync(s.fd);
  }
  spools.clear();
}

/** Fragments of one dictionary, in the order they were added: [entryKey, kind, value]. */
export async function* readSpool(id: string): AsyncGenerator<[string, ...Fragment]> {
  yield* readSpoolFile(id);
}

/** Sentences of a dictionary's sentence store: [sentence id, sentence]. */
export async function* readStore(id: string): AsyncGenerator<[number, Sentence]> {
  yield* readSpoolFile(`${id}.store`) as AsyncGenerator<any>;
}

async function* readSpoolFile(name: string): AsyncGenerator<any> {
  const file = path.join(SPOOL, `${name}.jsonl`);
  if (!fs.existsSync(file)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) if (line) yield JSON.parse(line);
}

/** Spool file size, for sizing chunk counts (0 when the dictionary has no such data). */
export const spoolSize = (name: string) => {
  const file = path.join(SPOOL, `${name}.jsonl`);
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
};

export function addEntry(id: string, entry: DictEntry) {
  const h = headword(entry.word);
  h.dicts.add(id);
  spool(id, entryKey(entry.word), ["e", entry]);
}

/**
 * Adds a backlink: "this word is given as a translation of `link.word`". The same backlink (word,
 * part of speech, sense) is stored once.
 */
const seenBacklinks = new Set<string>();
export function addBacklink(id: string, target: string, link: Backlink): boolean {
  const key = entryKey(target);
  const seen = `${id}\u0000${key}\u0000${link.word}\u0000${link.pos}\u0000${link.sense}`;
  if (seenBacklinks.has(seen)) return false;
  seenBacklinks.add(seen);
  headword(target).dicts.add(id);
  spool(id, key, ["b", link]);
  return true;
}

/** Stores a sentence (with its translations) once in a dictionary's sentence store. */
export function addSentence(id: string, sid: number, sentence: Sentence) {
  write(`${id}.store`, JSON.stringify([sid, sentence]));
}

/** Lists a stored sentence under an existing headword (sentences never create headwords). */
export function addSentenceRef(id: string, key: string, sid: number): boolean {
  const h = headwords.get(key);
  if (!h) return false;
  h.dicts.add(id);
  spool(id, key, ["s", sid]);
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

/** Lines of a text file (TSV), without loading it whole. */
export async function* lines(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) if (line) yield line;
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

/** Extracts a zip, .tgz or .tar.bz2 into raw/<dir> once. */
export function extract(archive: string, dir: string) {
  const dest = raw(dir);
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(dest + ".part", { recursive: true });
  if (archive.endsWith(".zip") && process.platform !== "win32") execFileSync("unzip", ["-oq", raw(archive), "-d", dest + ".part"], { stdio: "inherit" });
  // GNU tar (Linux) can't read zip; Windows ships bsdtar, which can
  else execFileSync("tar", ["-xf", raw(archive), "-C", dest + ".part"], { stdio: "inherit" });
  fs.renameSync(dest + ".part", dest);
}

/** Decompresses raw/<file>.bz2 next to itself once. */
export function bunzip(file: string) {
  if (!fs.existsSync(raw(file.replace(/\.bz2$/, "")))) execFileSync("bunzip2", ["-kf", raw(file)], { stdio: "inherit" });
}
