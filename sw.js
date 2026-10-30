const CACHE = "wordly-shell-v4";
const ASSETS = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const response = await fetch(event.request, { cache: "no-store" });

      if (response && response.ok) {
        await cache.put(event.request, response.clone());
      }

      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      if (event.request.mode === "navigate") {
        const fallbackUrl = new URL("./index.html", self.registration.scope).href;
        const fallback = await cache.match(fallbackUrl);
        if (fallback) return fallback;
      }

      return Response.error();
    }
  })());
});
