import "server-only";

import { serverEnv } from "@/lib/env";

/**
 * The image seam.
 *
 * Images live in Supabase Storage and Mongo stores the URL string only — the
 * 512 MB Atlas free tier is for documents, and a few hundred dispute photos
 * would eat it (DECISIONS section 3).
 *
 * Until Supabase credentials exist, the stub keeps the whole dispute flow
 * demonstrable by inlining the bytes as a data URL. That is a deliberate,
 * bounded compromise and it is fenced accordingly:
 *
 *   · hard 400 KB ceiling per file, enforced here rather than trusted from the
 *     client, which already downscales with a canvas before uploading
 *   · refused outright in production, the same way the stub auth provider is
 *
 * Swapping in `SupabaseStorageProvider` is a one-file change; nothing above
 * this module knows which one is active.
 */

export const MAX_UPLOAD_BYTES = 400 * 1024;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export interface StoragePutParams {
  bytes: Uint8Array;
  contentType: AllowedImageType;
  /** Logical bucket path, e.g. "disputes/<orderId>". */
  folder: string;
}

export interface StorageProvider {
  readonly name: "stub" | "supabase";
  put(params: StoragePutParams): Promise<{ url: string }>;
}

const stubStorage: StorageProvider = {
  name: "stub",

  put: async ({ bytes, contentType }) => {
    if (serverEnv().NODE_ENV === "production") {
      throw new Error(
        "The stub storage provider inlines images into MongoDB and must not run in production. " +
          "Configure Supabase Storage first.",
      );
    }
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error(`Image is ${bytes.byteLength} bytes; the ceiling is ${MAX_UPLOAD_BYTES}.`);
    }
    return { url: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}` };
  },
};

const supabaseStorage: StorageProvider = {
  name: "supabase",

  put: async () => {
    throw new Error("Supabase Storage is not wired yet (Phase 8). Images fall back to the stub.");
  },
};

export function storageProvider(): StorageProvider {
  // Tied to AUTH_PROVIDER on purpose: the Supabase project that holds the
  // buckets is the same one that holds the auth users, so they arrive together
  // rather than needing a second flag nobody remembers to flip.
  return serverEnv().AUTH_PROVIDER === "supabase" ? supabaseStorage : stubStorage;
}

export function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}
