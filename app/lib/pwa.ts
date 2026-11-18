// PWA: registers the service worker built by scripts/postbuild.ts (public/sw.js does not exist in
// dev, and a worker would cache the dev server's modules, so it only runs in a production build).
//
// Updates: a deploy changes sw.js; the browser installs the new worker, which takes over at once
// (skipWaiting + clients.claim). The page then reloads once so code and the cached shell match. The
// URL holds every setting, so the reload lands on the same word.
export function registerServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // the first install takes control without a reload; only an update reloads
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  // after the page has loaded, so installing the worker doesn't compete with the first lookup
  const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
