/* Service Worker: Cache para uso offline no campo (Tekó Biotech) */
const VERSAO = "teko-v7";
const ARQUIVOS = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/canvas_planta.js",
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
    fetch(e.request)
      .then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          void caches.open(VERSAO).then((c) => {
            void c.put(e.request, copia);
          }).catch(() => {});
        }
        return resp;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(
          (hit) => hit || caches.match("index.html")
        )
      )
  );
});
