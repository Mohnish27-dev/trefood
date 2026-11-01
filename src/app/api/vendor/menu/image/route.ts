import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/server/auth/session";
import { ROLE } from "@/lib/constants";
import * as db from "@/server/db/collections";
import { saveMenuImage, deleteMenuImage } from "@/server/services/menu-image-storage";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB ceiling

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Determine authorized restaurant
  let restaurantId: string | null = null;
  const isVendor = session.role === ROLE.VENDOR_OWNER || session.role === ROLE.VENDOR_STAFF;
  const isAdmin =
    session.role === ROLE.ADMIN ||
    session.role === ROLE.SUPER_ADMIN ||
    session.role === ROLE.CO_ADMIN;

  if (isVendor) {
    restaurantId = session.user.restaurantId ?? null;
    if (!restaurantId) {
      return NextResponse.json(
        { error: "Forbidden: No restaurant assigned to this vendor" },
        { status: 403 },
      );
    }
  } else if (isAdmin) {
    // Admins can upload for any restaurant
  } else {
    return NextResponse.json(
      { error: "Forbidden: Vendor or Admin access required" },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid image format. Only JPG, PNG, and WebP are allowed." },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Image file is too large. Maximum size is 5 MB." },
      { status: 400 },
    );
  }

  const itemId = formData.get("itemId") as string | null;
  const targetRestaurantId = (formData.get("restaurantId") as string | null) || restaurantId;

  if (!targetRestaurantId && !restaurantId) {
    return NextResponse.json({ error: "Restaurant ID is required" }, { status: 400 });
  }

  const effectiveRestaurantId = restaurantId || targetRestaurantId!;

  // If itemId provided, verify it belongs to this restaurant
  if (itemId) {
    const itemsCollection = await db.menuItems();
    const item = await itemsCollection.findOne({
      _id: itemId,
      restaurantId: effectiveRestaurantId,
    });
    if (!item) {
      return NextResponse.json(
        { error: "Menu item not found in your restaurant" },
        { status: 404 },
      );
    }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await saveMenuImage({
      bytes,
      contentType: file.type,
      originalName: file.name,
      restaurantId: effectiveRestaurantId,
      itemId: itemId ?? undefined,
      uploadedBy: session.user._id,
    });

    // If itemId was provided, update the item record right away
    if (itemId) {
      const itemsCollection = await db.menuItems();
      const existing = await itemsCollection.findOne({
        _id: itemId,
        restaurantId: effectiveRestaurantId,
      });

      // Clean up old image if it was in /api/menu-images/
      if (existing?.imageUrl && existing.imageUrl.startsWith("/api/menu-images/")) {
        const oldFileId = existing.imageUrl.replace("/api/menu-images/", "");
        void deleteMenuImage(oldFileId);
      }

      await itemsCollection.updateOne(
        { _id: itemId, restaurantId: effectiveRestaurantId },
        { $set: { imageUrl: result.url } },
      );

      revalidatePath("/vendor/menu");
      revalidatePath(`/admin/vendors/${effectiveRestaurantId}/menu`);
    }

    return NextResponse.json({
      ok: true,
      url: result.url,
      imageUrl: result.url,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("Failed to upload menu image:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const fileId = searchParams.get("fileId");

  let restaurantId: string | null = null;
  const isVendor = session.role === ROLE.VENDOR_OWNER || session.role === ROLE.VENDOR_STAFF;
  const isAdmin =
    session.role === ROLE.ADMIN ||
    session.role === ROLE.SUPER_ADMIN ||
    session.role === ROLE.CO_ADMIN;

  if (isVendor) {
    restaurantId = session.user.restaurantId ?? null;
  } else if (isAdmin) {
    // Admin allowed
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (itemId) {
    const itemsCollection = await db.menuItems();
    const filter = restaurantId ? { _id: itemId, restaurantId } : { _id: itemId };
    const item = await itemsCollection.findOne(filter);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.imageUrl?.startsWith("/api/menu-images/")) {
      const oldId = item.imageUrl.replace("/api/menu-images/", "");
      void deleteMenuImage(oldId);
    }

    await itemsCollection.updateOne(filter, { $set: { imageUrl: null } });
    revalidatePath("/vendor/menu");
    if (item.restaurantId) {
      revalidatePath(`/admin/vendors/${item.restaurantId}/menu`);
    }

    return NextResponse.json({ ok: true });
  }

  if (fileId) {
    await deleteMenuImage(fileId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing itemId or fileId" }, { status: 400 });
}
