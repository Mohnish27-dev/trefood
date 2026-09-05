/**
 * TREFOOD service worker.
 *
 * ★ THE RULE THAT OUTRANKS EVERY OTHER RULE IN THIS FILE ★
 *
 *   ORDER STATE IS NEVER CACHED. NOT ONCE, NOT BRIEFLY, NOT "JUST THE SHELL".
 *
 * A stale "Cooking" screen while the rider is standing at the gate is worse
 * than a spinner, worse than an error, and worse than no app at all — the
 * student stays in their room, the fifteen-minute grace runs out, and the food
 * goes to the security desk. Every order read is network-only, and there is no
 * fallback that could serve an old one by accident.
 *
 * What IS cached is the part that is safe to be a few hours old: the app
 * shell, the fonts, the icons and menu images. Browsing works on a bad
 * connection; ordering does not, and cannot, because payment needs the network
 * anyway.
 */

const VERSION = "trefood-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/** The minimum needed to render something honest while offline. */
const SHELL = ["/", "/offline", "/manifest.json", "/icons/icon-192.png"];

/**
 * Anything matching these is network-only, forever.
 *
 * Deliberately broad. A new order endpoint added next month is caught by
 * `/api/` without anyone having to remember this file exists.
 */
const NEVER_CACHE = [
  /^\/api\//,
  /^\/orders(\/|$)/,
  /^\/vendor(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/checkout(\/|$)/,
  /^\/cart(\/|$)/,
  /^\/demo(\/|$)/,
  // Next build assets contain Server Action references. Let Next/the browser
  // manage its content-hashed files so an old service-worker cache cannot pair
  // a previous client bundle with the current server deployment.
  /^\/_next\//,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 does not fail the whole install and leave the
      // worker permanently un-activated.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Rule one, enforced first and with no fallback path.
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  // Navigations: try the network, fall back to the offline page. Never to a
  // cached copy of another page, which is how someone ends up looking at
  // yesterday's restaurant list believing it is live.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline").then((hit) => hit ?? offlineResponse())),
    );
    return;
  }

  // Public static assets: cache first. `/_next/` is excluded above because
  // framework-generated JS can contain deployment-specific Server Action IDs.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

function isStaticAsset(pathname) {
  if (pathname.includes("turbopack") || pathname.includes("hot-update")) return false;
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    /\.(?:woff2?|png|jpe?g|webp|svg|ico|css|js)$/.test(pathname)
  );
}

function offlineResponse() {
  return new Response(
    "<!doctype html><meta charset=utf-8><title>Offline</title>" +
      "<body style=\"background:#0B0D12;color:#F5F3EF;font-family:system-ui;padding:2rem\">" +
      "<h1>You are offline</h1><p>Any order you have already placed is safe. " +
      "Reconnect to see where it is.</p>",
    { headers: { "content-type": "text/html; charset=utf-8" }, status: 200 },
  );
}

/* ------------------------------------------------------------------ */
/* Web Push                                                            */
/* ------------------------------------------------------------------ */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "TREFOOD", body: event.data.text(), url: "/orders" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "TREFOOD", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // The order id, so "on the way" then "at your gate" replace each other
      // instead of stacking up four deep on a lock screen.
      tag: payload.tag ?? "trefood",
      renotify: true,
      requireInteraction: payload.requireInteraction === true,
      data: { url: payload.url ?? "/orders" },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse an open tab rather than piling up windows — a student tapping
      // three notifications should not end with three copies of the app.
      for (const client of clients) {
        if ("focus" in client) {
          void client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
