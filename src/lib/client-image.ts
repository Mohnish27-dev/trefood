/**
 * Client-side image compression and upload utilities for food menu images.
 *
 * Scales down large mobile phone camera photos (e.g. 12MP, 5-10MB) before upload
 * into an optimized WebP or JPEG (~50-100KB) to ensure rapid uploads on campus Wi-Fi
 * and mobile networks.
 */

export async function compressImageFile(
  file: File,
  maxDimension = 960,
  quality = 0.85,
): Promise<File> {
  // If already under 120KB and is modern format, return as is
  if (file.size <= 120 * 1024 && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file;
  }

  // Only compress raster images
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.trunc((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.trunc((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const outputType = "image/webp";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const compressedFile = new File([blob], `${baseName}.webp`, {
            type: outputType,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        outputType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

export async function uploadMenuItemImage(
  file: File,
  itemId?: string,
  restaurantId?: string,
): Promise<{ ok: boolean; imageUrl?: string; error?: string }> {
  try {
    const optimized = await compressImageFile(file);

    const formData = new FormData();
    formData.append("file", optimized);
    if (itemId) formData.append("itemId", itemId);
    if (restaurantId) formData.append("restaurantId", restaurantId);

    const res = await fetch("/api/vendor/menu/image", {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || "Failed to upload image." };
    }

    return { ok: true, imageUrl: data.imageUrl || data.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error uploading image";
    return { ok: false, error: message };
  }
}

export async function deleteMenuItemImage(
  itemId?: string,
  fileId?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (itemId) params.set("itemId", itemId);
    if (fileId) params.set("fileId", fileId);

    const res = await fetch(`/api/vendor/menu/image?${params.toString()}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || "Failed to delete image." };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error deleting image";
    return { ok: false, error: message };
  }
}
