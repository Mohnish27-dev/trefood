import { NextResponse } from "next/server";

import { logoutCurrentSession } from "@/server/auth/logout";
import { isSameOriginMutation } from "@/server/http/same-origin";

export async function POST(request: Request): Promise<NextResponse> {
  const respond = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

  if (!isSameOriginMutation(request)) {
    return respond({ status: "error", message: "Invalid request origin." }, 403);
  }

  try {
    // Also works for an expired session. No authenticated layout is re-rendered
    // after the cookies are removed, and the client loads the login document.
    await logoutCurrentSession();
    return respond({ status: "ok" });
  } catch (error: unknown) {
    console.error("Vendor logout failed", error);
    return respond({ status: "error", message: "Could not sign out. Please retry." }, 500);
  }
}
