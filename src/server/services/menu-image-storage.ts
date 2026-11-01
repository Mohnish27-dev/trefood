import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { GridFSBucket, ObjectId } from "mongodb";

import { getDb } from "@/server/db/client";

/**
 * Menu image storage backed by MongoDB GridFS with local disk cache fallback.
 *
 * Each image is stored in the `menuImages` GridFS bucket so it survives container
 * redeploys and horizontal scaling on EC2 / Docker without requiring separate
 * object storage credentials.
 *
 * When filesystem access is writable, a local file is also cached in
 * `public/uploads/menu/` for rapid serving.
 */

export interface SaveMenuImageParams {
  bytes: Uint8Array | Buffer;
  contentType: string;
  originalName?: string | undefined;
  restaurantId: string;
  itemId?: string | undefined;
  uploadedBy?: string | undefined;
}

export interface MenuImageResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  length?: number | undefined;
  filename: string;
}

export async function saveMenuImage(
  params: SaveMenuImageParams,
): Promise<{ fileId: string; url: string }> {
  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: "menuImages" });

  const objectId = new ObjectId();
  const fileId = objectId.toHexString();
  const ext =
    params.contentType === "image/png"
      ? "png"
      : params.contentType === "image/webp"
        ? "webp"
        : "jpg";
  const filename = `${fileId}.${ext}`;

  // 1. Upload to GridFS
  await new Promise<void>((resolve, reject) => {
    const uploadStream = bucket.openUploadStreamWithId(objectId, filename, {
      metadata: {
        contentType: params.contentType,
        restaurantId: params.restaurantId,
        itemId: params.itemId,
        uploadedBy: params.uploadedBy,
        originalName: params.originalName,
        createdAt: new Date(),
      },
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve());
    uploadStream.end(Buffer.from(params.bytes));
  });

  // 2. Best-effort cache to public/uploads/menu/
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "menu");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(params.bytes));
  } catch {
    // Non-fatal if filesystem is read-only
  }

  return {
    fileId,
    url: `/api/menu-images/${fileId}`,
  };
}

export async function getMenuImage(idOrName: string): Promise<MenuImageResult | null> {
  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: "menuImages" });

  // 1. Check GridFS by ObjectId
  if (ObjectId.isValid(idOrName)) {
    const objId = new ObjectId(idOrName);
    const files = await bucket.find({ _id: objId }).limit(1).toArray();
    const fileDoc = files[0];
    if (fileDoc) {
      const stream = bucket.openDownloadStream(fileDoc._id);
      const metadata = fileDoc.metadata as Record<string, unknown> | undefined;
      const contentType = (metadata?.contentType as string) || "image/jpeg";
      return {
        stream,
        contentType,
        length: fileDoc.length,
        filename: fileDoc.filename,
      };
    }
  }

  // 2. Check GridFS by filename
  const byFilename = await bucket.find({ filename: idOrName }).limit(1).toArray();
  const fileDocNamed = byFilename[0];
  if (fileDocNamed) {
    const stream = bucket.openDownloadStream(fileDocNamed._id);
    const metadata = fileDocNamed.metadata as Record<string, unknown> | undefined;
    const contentType = (metadata?.contentType as string) || "image/jpeg";
    return {
      stream,
      contentType,
      length: fileDocNamed.length,
      filename: fileDocNamed.filename,
    };
  }

  // 3. Fallback: check disk cache in public/uploads/menu or public/menu
  try {
    const clean = path.basename(idOrName);
    const searchDirs = [
      path.join(process.cwd(), "public", "uploads", "menu"),
      path.join(process.cwd(), "public", "menu"),
    ];

    for (const dir of searchDirs) {
      const candidates = [clean, `${clean}.jpg`, `${clean}.jpeg`, `${clean}.png`, `${clean}.webp`];
      for (const cand of candidates) {
        const filePath = path.join(dir, cand);
        try {
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            const { createReadStream } = await import("node:fs");
            const ext = path.extname(filePath).toLowerCase();
            const contentType =
              ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
            return {
              stream: createReadStream(filePath),
              contentType,
              length: stat.size,
              filename: cand,
            };
          }
        } catch {
          // File not found in this path, try next
        }
      }
    }
  } catch {
    // Disk fallback failed
  }

  return null;
}

export async function deleteMenuImage(idOrName: string): Promise<boolean> {
  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: "menuImages" });

  let fileId: ObjectId | null = null;
  if (ObjectId.isValid(idOrName)) {
    fileId = new ObjectId(idOrName);
  } else {
    const files = await bucket.find({ filename: idOrName }).limit(1).toArray();
    const first = files[0];
    if (first) {
      fileId = first._id;
    }
  }

  if (fileId) {
    try {
      await bucket.delete(fileId);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
