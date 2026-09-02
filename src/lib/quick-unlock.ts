/**
 * Quick Unlock Utilities for TREFOOD Mobile PWA.
 *
 * Provides:
 * 1. Web Crypto SHA-256 salted PIN hashing & verification
 * 2. WebAuthn platform biometric authentication (Face ID, Touch ID, Fingerprint, Windows Hello)
 * 3. LocalStorage persistence for quick unlock profile and lock state
 */

export interface StoredQuickUnlockProfile {
  userId: string;
  name: string;
  email: string;
  pinHash: string;
  pinSalt: string;
  biometricEnabled: boolean;
  credentialId?: string | null;
  requireOnOpen?: boolean;
  updatedAt: number;
}

const STORAGE_KEY = "trefood_quick_unlock_v1";
const LOCK_STATE_KEY = "trefood_app_locked";

/* ------------------------------------------------------------------ */
/* Storage Helpers                                                     */
/* ------------------------------------------------------------------ */

export function getStoredQuickUnlockProfile(): StoredQuickUnlockProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredQuickUnlockProfile;
  } catch {
    return null;
  }
}

export function setStoredQuickUnlockProfile(profile: StoredQuickUnlockProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Failed to save quick unlock profile to localStorage:", err);
  }
}

export function clearStoredQuickUnlockProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LOCK_STATE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getAppLockState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCK_STATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAppLockState(locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (locked) {
      window.localStorage.setItem(LOCK_STATE_KEY, "1");
    } else {
      window.localStorage.removeItem(LOCK_STATE_KEY);
    }
  } catch {
    // Ignore
  }
}

/* ------------------------------------------------------------------ */
/* PIN Hashing & Verification (Web Crypto API)                         */
/* ------------------------------------------------------------------ */

/** Generates a cryptographically random 16-byte hex salt string */
export function generatePinSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Computes SHA-256(salt + pin) using browser Web Crypto */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin.trim()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validates whether the given PIN matches the salted hash */
export async function verifyPin(pin: string, expectedHash: string, salt: string): Promise<boolean> {
  if (!pin || pin.length !== 4) return false;
  const computed = await hashPin(pin, salt);
  return computed === expectedHash;
}

/* ------------------------------------------------------------------ */
/* WebAuthn Platform Biometrics                                       */
/* ------------------------------------------------------------------ */

/**
 * Checks if this browser / device supports platform biometrics
 * (Face ID, Touch ID, Android Biometrics, Windows Hello).
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }

  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Registers a platform biometric credential (Face ID, Fingerprint, Windows Hello).
 * Returns the base64url-encoded credentialId, or null if cancelled / unsupported.
 */
export async function registerBiometrics(
  userId: string,
  userName: string,
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { success: false, error: "Biometric authentication is not supported on this device." };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const encoder = new TextEncoder();
    const userHandle = encoder.encode(userId.slice(0, 32));

    const creationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "TREFOOD",
        id: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
      },
      user: {
        id: userHandle,
        name: userName || "TREFOOD Student",
        displayName: userName || "TREFOOD Student",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: "Biometric setup was cancelled." };
    }

    const credentialId = bufferToBase64Url(credential.rawId);
    return { success: true, credentialId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to set up biometric authentication.";
    return { success: false, error: message };
  }
}

/**
 * Prompts the user with device biometrics (Face ID, Fingerprint, Touch ID, Windows Hello).
 */
export async function authenticateWithBiometrics(
  credentialId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined" || !navigator.credentials) {
    return { success: false, error: "Biometrics not supported on this browser." };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialId) {
      allowCredentials.push({
        id: base64UrlToBuffer(credentialId),
        type: "public-key",
        transports: ["internal"],
      });
    }

    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
      userVerification: "required",
      timeout: 60000,
      ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
    };

    const assertion = await navigator.credentials.get({
      publicKey: requestOptions,
    });

    if (!assertion) {
      return { success: false, error: "Biometric authentication failed or cancelled." };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Biometric verification failed.";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/* Binary / Base64 Helpers                                             */
/* ------------------------------------------------------------------ */

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const val = bytes[i];
    if (val !== undefined) {
      binary += String.fromCharCode(val);
    }
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
