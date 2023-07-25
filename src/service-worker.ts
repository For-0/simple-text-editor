import { manifest, version } from "@parcel/service-worker";

addEventListener("install", e => e.waitUntil(caches.open(version).then(cache => cache.addAll(manifest))));
addEventListener("activate", e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== version).map(key => caches.delete(key))))));

addEventListener("fetch", e => {
  const requestUrl = new URL(e.request.url);
  const cacheRequest = requestUrl.pathname === "/" ? "/index.html" : e.request;
  e.respondWith(caches.match(cacheRequest).then(res => res || fetch(e.request)));
});