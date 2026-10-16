// Ward Jobs service worker: makes the app open offline. Only the app's own files are cached;
// patient data lives in the phone's local storage, never in this cache.
const CACHE = "ward-jobs-shell-v2";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never touch sync traffic
  if (req.mode === "navigate") {
    // Network first so updates arrive; fall back to the cached app offline
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  // Hashed build files never change: cache first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; })));
});

// Push from the sync server: a generic "list updated" alert (the server can't read the list).
self.addEventListener("push", (e) => {
  let msg = { title: "Ward Jobs", body: "Your team list has been updated", tag: "ward-jobs-update" };
  try { if (e.data) msg = { ...msg, ...e.data.json() }; } catch { /* keep default */ }
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // App open and on screen: it shows its own detailed alert instead
      if (wins.some((w) => w.visibilityState === "visible")) return;
      return self.registration.showNotification(msg.title, { body: msg.body, tag: msg.tag, renotify: true, icon: "./icon-192.png", badge: "./icon-192.png" });
    }),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if ("focus" in w) return w.focus();
      return self.clients.openWindow("./");
    }),
  );
});
