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

const VERSION = "trefood-v3";
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

/**
 * A long, unmistakable buzz for a vendor's new order. A phone lying on a
 * counter next to a hot tawa does not register the student pattern.
 */
const VENDOR_VIBRATION = [700, 250, 700, 250, 700, 250, 700];

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "TREFOOD", body: event.data.text(), url: "/orders" };
  }

  const isVendorAlert = payload.kind === "VENDOR_NEW_ORDER" || payload.kind === "VENDOR_TEST";

  // Always shown, even when the console is open and ringing: a push the page
  // swallows silently is how Chrome ends up revoking the permission, and a
  // second cue for an unanswered order costs nothing.
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "TREFOOD", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // The order id, so "on the way" then "at your gate" replace each other
      // instead of stacking up four deep on a lock screen. For a vendor, the
      // one-minute reminders replace the first alert the same way.
      tag: payload.tag ?? "trefood",
      renotify: true,
      requireInteraction: payload.requireInteraction === true,
      silent: false,
      timestamp: Date.now(),
      data: { url: payload.url ?? (isVendorAlert ? "/vendor/orders" : "/orders"), kind: payload.kind ?? null },
      vibrate: isVendorAlert ? VENDOR_VIBRATION : [80, 40, 80],
      ...(payload.kind === "VENDOR_NEW_ORDER"
        ? { actions: [{ action: "open", title: "Open orders" }] }
        : {}),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/orders", self.location.origin);

  event.waitUntil(focusOrOpen(target));
});

/**
 * Reuse an open window rather than piling up copies of the app — a student
 * tapping three notifications should not end with three windows, and a vendor
 * tapping an alert should land on the board they already have open.
 */
async function focusOrOpen(target) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const sameOrigin = windows.filter((client) => new URL(client.url).origin === target.origin);

  // Already showing the target (the vendor board is open in the background):
  // bring it forward and tell it to refresh now instead of on its next poll.
  const exact = sameOrigin.find((client) => new URL(client.url).pathname === target.pathname);
  if (exact) {
    exact.postMessage({ type: "trefood:notification-click", url: target.href });
    return exact.focus();
  }

  for (const client of sameOrigin) {
    try {
      const focused = await client.focus();
      // navigate() rejects for a window this worker does not control yet.
      const navigated = await (focused ?? client).navigate(target.href);
      if (navigated) return navigated;
    } catch {
      // Try the next window, then fall back to a fresh one.
    }
  }

  return self.clients.openWindow(target.href);
}

/**
 * The browser re-issued this device's subscription.
 *
 * Chrome does this on its own schedule, and the old endpoint stops working the
 * moment it happens. Without this handler the vendor's phone looks subscribed —
 * permission granted, no error anywhere — while every order push 410s against
 * a dead endpoint. Re-register immediately; the same-origin fetch carries the
 * session cookie, so the row is re-bound to the right account.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(resubscribe(event));
});

async function resubscribe(event) {
  const oldSubscription = event.oldSubscription;
  const key =
    event.newSubscription?.options?.applicationServerKey ??
    oldSubscription?.options?.applicationServerKey;

  try {
    const subscription =
      event.newSubscription ??
      (key
        ? await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          })
        : null);

    if (oldSubscription?.endpoint && oldSubscription.endpoint !== subscription?.endpoint) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: oldSubscription.endpoint }),
      }).catch(() => undefined);
    }

    if (!subscription) return;

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch {
    // The console re-syncs this device on its next load anyway.
  }
}
