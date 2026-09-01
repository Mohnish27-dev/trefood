import { NextResponse } from "next/server";

import { getSession } from "@/server/auth/session";
import {
  MAX_UPLOAD_BYTES,
  isAllowedImageType,
  storageProvider,
} from "@/server/services/storage";

/**
 * Dispute photo upload.
 *
 * Photo evidence is mandatory on every dispute — no photo, no dispute — so
 * this is a load-bearing endpoint rather than a nicety. It is also the only
 * place in the product where a student can put bytes on our infrastructure,
 * which is why it is narrow on purpose:
 *
 *   · authenticated, always
 *   · three image types, checked against the actual field, not the filename
 *   · a hard byte ceiling enforced server-side, even though the client already
 *     downscales with a canvas — the client is not authorisation
 *
 * The bytes go through the storage seam, so swapping the stub for Supabase
 * Storage changes one file and nothing here.
 */

export const dynamic = "force-dynamic";

export interface UploadResponse {
  url: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }

  if (!isAllowedImageType(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG or WebP photos can be attached" },
      { status: 415 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `That photo is too large. The limit is ${Math.trunc(MAX_UPLOAD_BYTES / 1024)} KB.` },
      { status: 413 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { url } = await storageProvider().put({
      bytes,
      contentType: file.type,
      folder: `disputes/${session.user._id}`,
    });
    return NextResponse.json({ url } satisfies UploadResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
