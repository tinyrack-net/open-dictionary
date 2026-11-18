// Service worker (PWA). scripts/postbuild.ts fills in the placeholders and writes build/client/sw.js;
// every deploy produces a new file, so browsers install the new version and drop the old caches.
//
// What is cached, and how:
//   app shell   prerendered pages (/en, /en/word, …), their .data files, JS/CSS/fonts, icons
//               precached at install; pages are network-first (fresh when online, cached offline),
//               hashed assets are cache-first (their names change when their content does)
//   dictionary  /data/<version>/… cache-first, kept as they are looked up (the files never change for
//   data        a version: app/lib/dataVersion.ts), so words opened once also work offline.
//               Capped at DATA_LIMIT files, oldest first.
//   other       not handled (audio from Wikimedia Commons, version.txt, cross-origin requests)
//
// Settings live in the URL and the word page loads its data in the browser, so one cached shell per
// page serves every word: /en/word?word=<anything> is answered with the cached /en/word page.

const BUILD = "__BUILD__";
const DATA_VERSION = "__DATA_VERSION__";
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = `shell-${BUILD}`;
const DATA_CACHE = `data-${DATA_VERSION}`;
const DATA_LIMIT = 400;

/**
 * A navigation can't be answered with a response that was redirected (the host turns /en/ into /en),
 * so cached copies are stored without the redirect flag.
 */
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map(async (url) => {
            const res = await fetch(url, { cache: "reload" });
            if (!res.ok) throw new Error(`precache ${url}: ${res.status}`);
            await cache.put(url, await clean(res));
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * The prerendered page that serves a URL, by its clean path (the host serves /en/word/index.html as
 * /en/word): /en/word?word=x -> /en/word; anything else -> "/", the SPA fallback page.
 */
function shellFor(url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return PRECACHE.includes(path) ? path : "/";
}

async function networkFirst(request, fallback) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallback, await clean(res.clone()));
    return res;
  } catch {
    return (await cache.match(fallback)) ?? (await cache.match("/")) ?? Response.error();
  }
}

async function cacheFirst(cacheName, request, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    if (limit) {
      const keys = await cache.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(k);
    }
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, shellFor(url)));
  } else if (url.pathname.startsWith(`/data/${DATA_VERSION}/`)) {
    event.respondWith(cacheFirst(DATA_CACHE, request, DATA_LIMIT));
  } else if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(SHELL_CACHE, request));
  } else if (url.pathname.endsWith(".data") && PRECACHE.includes(url.pathname)) {
    // route data of the prerendered pages (client-side navigation): fresh when online
    event.respondWith(networkFirst(request, url.pathname));
  }
});
