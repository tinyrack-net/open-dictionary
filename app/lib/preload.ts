// First-visit speed: an inline <head> script that starts the word page's data requests while the
// app's JavaScript is still downloading. Without it the browser fetches the HTML, then ~25 JS
// files, and only then the data: three round trips in a row on a cold load.
//
// The script reads ?word= and ?dicts= and requests the same files data.ts would (lookupPaths),
// storing the promises on window.__odPreload for readJson to reuse. It is plain JavaScript because
// it runs before any bundle; preload.test.ts checks it against lookupPaths for many words, so a
// change to hashing, shard counts or dictionary slugs that isn't mirrored here fails the tests.
import { dataUrl } from "./dataVersion.ts";
import { SHARDS } from "./keys.ts";
import { DICTIONARIES } from "./dicts.ts";

export function preloadScript(): string {
  const slugs = Object.fromEntries(DICTIONARIES.map((d) => [d.slug, d.id]));
  const all = DICTIONARIES.map((d) => d.id);
  return `(function () {
  try {
    if (!/\\/word$/.test(location.pathname)) return;
    var q = new URLSearchParams(location.search);
    var word = (q.get("word") || "").normalize("NFC").trim().toLowerCase();
    if (!word) return;
    var SHARDS = ${JSON.stringify(SHARDS)}, SLUGS = ${JSON.stringify(slugs)}, ALL = ${JSON.stringify(all)}, BASE = ${JSON.stringify(dataUrl(""))};
    var d = q.get("dicts"), dicts = ALL;
    if (d !== null) { dicts = []; d.split(",").forEach(function (s) { var id = SLUGS[s.trim()]; if (id && dicts.indexOf(id) < 0) dicts.push(id); }); }
    var h = 0x811c9dc5;
    for (var i = 0; i < word.length; i++) { h ^= word.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h = h >>> 0;
    function shard(n) { var w = Math.max(1, (n - 1).toString(16).length), s = (h % n).toString(16); while (s.length < w) s = "0" + s; return s; }
    var ids = dicts.slice();
    if (dicts.indexOf("enko") >= 0 || dicts.indexOf("ko") >= 0) ids.push("ex");
    var paths = ["i/manifest.json"].concat(ids.map(function (id) { return "d/" + id + "/" + shard(SHARDS[id]) + ".json"; }));
    var out = (window.__odPreload = {});
    // A request cancelled by leaving the page (reload, back) rejects; nothing may be waiting on it
    // yet, so mark it handled here (readJson still sees the rejection and treats it as a miss).
    function get(p) { var r = fetch(BASE + p); r.catch(function () {}); return r; }
    paths.forEach(function (p) { out[p] = get(p); });
    // The index chunk depends on the manifest (chunkFor in data.ts): request it as soon as the
    // manifest arrives instead of waiting for the app. Fold like foldKey: strip combining marks.
    var fold = word.normalize("NFD").replace(/\\p{M}/gu, "").normalize("NFC");
    out["i/manifest.json"].then(function (r) { return r.clone().json(); }).then(function (m) {
      var lo = 0, hi = m.first.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (m.first[mid] < fold) lo = mid; else hi = mid - 1; }
      var p = "i/" + lo + ".json";
      if (!out[p]) out[p] = get(p);
    }).catch(function () {});
  } catch (e) {}
})();`;
}
