import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/server/auth/session";
import { isPushConfigured, removeSubscription, saveSubscription } from "@/server/services/push";

/**
 * Web Push registration.
 *
 * One row per device, keyed on the endpoint, so a student with a phone and a
 * laptop is reachable on both and a browser re-registering the same device
 * does not turn one AT_GATE event into six buzzes.
 *
 * Push is never the only channel for anything (F17). If this endpoint is
 * unavailable, or the student denied the permission prompt, the in-app banner
 * and the polled tracker still carry every event.
 */

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1_000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!isPushConfigured()) {
    // Not an error: the prototype runs with no VAPID keys at all, and the
    // client needs to know so it can keep showing the in-app banner instead.
    return NextResponse.json({ ok: false, reason: "PUSH_NOT_CONFIGURED" }, { status: 200 });
  }

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await saveSubscription({
    userId: session.user._id,
    endpoint: parsed.data.endpoint,
    keys: parsed.data.keys,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const parsed = z
    .object({ endpoint: z.string().url() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await removeSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
