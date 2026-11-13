import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupPaths } from "./data.ts";
import { preloadScript } from "./preload.ts";
import { ALL_DICTS, parseDicts } from "./dicts.ts";

/** Runs the inline script against a fake window and returns the paths it requested. */
function run(url: string, manifest = { chunk: 1, first: [""] }) {
  const u = new URL(url, "https://example.test");
  const win: { __odPreload?: Record<string, unknown> } = {};
  const fakeFetch = async (p: string) => {
    const body = p.endsWith("manifest.json") ? manifest : {};
    const res = { ok: true, json: async () => body, clone: () => res, path: p };
    return res;
  };
  const fn = new Function("location", "window", "fetch", "URLSearchParams", preloadScript());
  fn(u, win, fakeFetch, URLSearchParams);
  return win;
}
const requested = (url: string) => Object.keys(run(url).__odPreload ?? {});

const WORDS = ["love", "Run", "give up", "café", "사랑", "먹다", "  water ", "ÉCOLE", "n'importe", "x"];
const DICTS = [null, "wordnet", "en-ko,ko-en", "wiktionary,en-ko", "", "bogus,ko-en", "ko-en,wordnet,ko-en"];

test("preload script requests exactly what getEntry will read", () => {
  for (const word of WORDS)
    for (const dicts of DICTS) {
      const qs = new URLSearchParams({ word, ...(dicts === null ? {} : { dicts }) });
      assert.deepEqual(
        requested(`/en/word?${qs}`),
        lookupPaths(word, parseDicts(dicts)),
        `${word} / ${dicts}`,
      );
    }
});

test("preload script does nothing off the word page or without a word", () => {
  assert.deepEqual(requested("/en?word=love"), []);
  assert.deepEqual(requested("/en/word"), []);
  assert.deepEqual(requested("/en/word?word=%20"), []);
});

test("preload script also requests the index chunk once the manifest arrives", async () => {
  // three chunks starting at "", "m", "t": "love" sorts into chunk 0, "run" into chunk 1
  const manifest = { chunk: 2500, first: ["", "m", "t"] };
  for (const [word, chunk] of [["love", 0], ["run", 1], ["zebra", 2], ["école", 0]] as const) {
    const win = run(`/en/word?word=${encodeURIComponent(word)}`, manifest);
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(Object.keys(win.__odPreload!).includes(`i/${chunk}.json`), `${word} -> i/${chunk}.json`);
  }
});

test("selected dictionaries keep the URL's order (the page shows them in that order)", () => {
  assert.deepEqual(parseDicts("wiktionary,wordnet"), ["en", "wn"]);
  assert.deepEqual(parseDicts("ko-en,bogus,ko-en,en-ko"), ["ko", "enko"]);
  assert.deepEqual(parseDicts(null), ALL_DICTS);
});

test("every dictionary is covered", () => {
  assert.equal(lookupPaths("love", ALL_DICTS).length, 1 + ALL_DICTS.length + 1);
});
