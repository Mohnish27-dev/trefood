import { after, NextResponse } from "next/server";

import { AuthError, requireVendor } from "@/server/auth/session";
import {
  countSubscriptions,
  isPushConfigured,
  sendVendorTestPush,
} from "@/server/services/push";

/**
 * "Send me a test alert."
 *
 * A vendor who turned notifications on has no way to know the whole chain
 * works on their phone — the service worker, the push service, battery saver —
 * until an order goes missing. This sends one to the caller's own devices
 * after a short delay, long enough to lock the phone or swipe the app away,
 * so what they see is exactly what a real order looks like with the app shut.
 */

export const dynamic = "force-dynamic";

// Not exported: a route file may only export handlers and segment config.
const TEST_PUSH_DELAY_SECONDS = 10;

export async function POST(): Promise<NextResponse> {
  try {
    const { user } = await requireVendor();

    if (!isPushConfigured()) {
      return NextResponse.json({ ok: false, reason: "PUSH_NOT_CONFIGURED" }, { status: 200 });
    }

    const devices = await countSubscriptions(user._id);
    if (devices === 0) {
      return NextResponse.json({ ok: false, reason: "NO_DEVICES" }, { status: 200 });
    }

    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, TEST_PUSH_DELAY_SECONDS * 1_000));
      await sendVendorTestPush(user._id).catch(() => 0);
    });

    return NextResponse.json({ ok: true, devices, delaySeconds: TEST_PUSH_DELAY_SECONDS });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
