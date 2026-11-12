/* Service worker: cache-first dos arquivos estáticos (uso no campo, rede ruim). */
const VERSAO = "agrosponge-v1";
const ARQUIVOS = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/charts.js",
  "js/content.js",
  "js/telegram.js",
  "icons/icon.svg",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).catch(() => caches.match("index.html"))
    )
  );
});
