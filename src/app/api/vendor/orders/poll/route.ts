import { NextResponse } from "next/server";

import { requireVendor, AuthError } from "@/server/auth/session";
import { getVendorBoard, type VendorBoard } from "@/server/services/vendor";

/**
 * The vendor board poll. Every 5 seconds, all night.
 *
 * Polling rather than websockets, deliberately: a socket dies at the
 * serverless function timeout and again every time a canteen tablet's wifi
 * blinks, and a vendor whose board silently stopped updating is a vendor about
 * to lose four orders. A poll that fails is visible — two failures in a row
 * raise the connection banner — and a poll recovers by itself.
 *
 * Never cached, at any layer. The whole value of this endpoint is that it is
 * current.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type VendorBoardResponse = VendorBoard;

export async function GET(): Promise<NextResponse> {
  try {
    // The restaurant id comes from the SESSION. There is no query parameter to
    // tamper with, so one vendor cannot poll another's board.
    const { restaurantId } = await requireVendor();

    const board = await getVendorBoard({ restaurantId });
    if (!board) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    return NextResponse.json(board, {
      headers: { "cache-control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    throw error;
  }
}
