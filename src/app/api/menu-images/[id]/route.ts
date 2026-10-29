import { Readable } from "node:stream";

import { getMenuImage } from "@/server/services/menu-image-storage";

export const dynamic = "force-dynamic";

/**
 * Serves food item images from MongoDB GridFS or cached storage.
 *
 * Emits aggressive immutable caching headers because images are keyed by unique ID.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id) {
    return new Response("Not found", { status: 404 });
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === `"${id}"`) {
    return new Response(null, { status: 304 });
  }

  try {
    const result = await getMenuImage(id);
    if (!result) {
      return new Response("Image not found", { status: 404 });
    }

    const webStream = Readable.toWeb(result.stream as any) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        ...(result.length ? { "Content-Length": String(result.length) } : {}),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${id}"`,
      },
    });
  } catch (error) {
    console.error("Error serving menu image:", error);
    return new Response("Error loading image", { status: 500 });
  }
}
