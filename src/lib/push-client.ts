import { clientEnv } from "@/lib/env";

/**
 * Browser-side Web Push plumbing, shared by the student card and the vendor
 * console. Nothing here renders; every function is safe to call from an event
 * handler or an effect and never throws.
 */

export type PushSupport =
  /** No Notification / service worker / PushManager — an in-app browser, an old tablet. */
  | "unsupported"
  /** iPhone or iPad in a Safari tab. Web push exists there only once added to the Home Screen. */
  | "ios-needs-install"
  /** This deployment has no VAPID key, so there is nothing to subscribe to. */
  | "unconfigured"
  | NotificationPermission;

export function readPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";

  const hasApis =
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

  if (!hasApis) return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  if (!clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "unconfigured";
  return Notification.permission;
}

export type SubscribeResult =
  | { ok: true }
  | {
      ok: false;
      /** `denied`: the user said no. `browser`: the push service refused. `server`: we could not save it. */
      reason: "denied" | "unsupported" | "browser" | "server" | "unconfigured";
    };

/**
 * Ask (if needed), subscribe, and register this device with the server.
 *
 * Also the re-sync path, run on every console load: it re-posts an existing
 * subscription so the server row follows whoever is signed in on this phone
 * now, and it replaces a subscription minted under an old VAPID key, which
 * would otherwise fail silently on every push forever.
 *
 * `requestPermission` must be reached from a tap on first use; once granted,
 * nothing here needs a gesture.
 */
export async function subscribeThisDevice(): Promise<SubscribeResult> {
  const support = readPushSupport();
  if (support === "unsupported" || support === "ios-needs-install") {
    return { ok: false, reason: "unsupported" };
  }
  if (support === "unconfigured") return { ok: false, reason: "unconfigured" };

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return { ok: false, reason: "denied" };

  let subscription: PushSubscription;
  try {
    const registration = await readyRegistration();
    const applicationServerKey = urlBase64ToUint8Array(clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "");

    const existing = await registration.pushManager.getSubscription();
    if (existing && !sameKey(existing.options.applicationServerKey, applicationServerKey)) {
      await existing.unsubscribe().catch(() => false);
    }

    subscription =
      existing && sameKey(existing.options.applicationServerKey, applicationServerKey)
        ? existing
        : await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  } catch {
    return { ok: false, reason: "browser" };
  }

  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) return { ok: false, reason: "server" };
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return body?.ok ? { ok: true } : { ok: false, reason: "unconfigured" };
  } catch {
    return { ok: false, reason: "server" };
  }
}

/**
 * Forget this device, server-side first.
 *
 * Called on sign-out, so a shared counter phone stops receiving a restaurant's
 * orders the moment its vendor signs out. Bounded, so a dead network can
 * never hold a sign-out hostage.
 */
export async function unsubscribeThisDevice(timeoutMs = 3_000): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const work = (async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => false);
  })().catch(() => undefined);

  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

/** True once this device holds a live subscription under the current key. */
export async function hasDeviceSubscription(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return Boolean(
      subscription &&
        sameKey(
          subscription.options.applicationServerKey,
          urlBase64ToUint8Array(clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
        ),
    );
  } catch {
    return false;
  }
}

/**
 * The service worker registration, registering it ourselves if needed.
 *
 * `ServiceWorkerRegistrar` waits for the load event, and `serviceWorker.ready`
 * never settles if nothing registers, so relying on it alone can hang a
 * button forever. Registering the same script twice is a no-op.
 */
async function readyRegistration(timeoutMs = 15_000): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/" });

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Service worker did not activate")), timeoutMs),
    ),
  ]);
}

function sameKey(current: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  if (bytes.length !== expected.length) return false;
  return bytes.every((byte, index) => byte === expected[index]);
}

/**
 * VAPID keys travel as URL-safe base64 and the Push API wants raw bytes.
 * Straight out of the web-push documentation; there is no shorter correct way.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(normalised);

  // Backed by a plain ArrayBuffer rather than the generic ArrayBufferLike, so
  // it satisfies `BufferSource` — a SharedArrayBuffer is not a valid key.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone)
  );
}
