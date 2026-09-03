import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as db from "@/server/db/collections";
import { ROLE } from "@/lib/constants";
import { newId } from "@/lib/ids";
import { resolveLandingPath } from "@/lib/routes";
import type { User } from "@/types/user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");

  // Determine actual public origin (handles reverse proxies like Cloudflare/Lightsail)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const origin = isLocalEnv
    ? request.nextUrl.origin
    : forwardedHost
      ? `https://${forwardedHost}`
      : (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const authUser = data.user;
      const usersCollection = await db.users();

      // Ensure MongoDB student profile exists or is linked
      let mongoUser = await usersCollection.findOne({ authId: authUser.id });

      if (!mongoUser && authUser.email) {
        mongoUser = await usersCollection.findOne({ email: authUser.email });
        if (mongoUser) {
          await usersCollection.updateOne(
            { _id: mongoUser._id },
            { $set: { authId: authUser.id, updatedAt: new Date() } },
          );
        }
      }

      if (!mongoUser) {
        const metaName =
          (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name) ||
          (typeof authUser.user_metadata?.name === "string" && authUser.user_metadata.name) ||
          authUser.email?.split("@")[0] ||
          "Student";

        const newStudent: User = {
          _id: newId("usr"),
          authId: authUser.id,
          role: ROLE.STUDENT,
          name: metaName,
          email: authUser.email ?? "",
          phone: authUser.phone ?? null,
          campusId: "campus_nitp",
          restaurantId: null,
          codBlocked: false,
          codBlockedReason: null,
          strikes: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await usersCollection.insertOne(newStudent);
        mongoUser = newStudent;
      }

      // `next` is only honoured when it is a local path that leads somewhere.
      // A bare "/" means "no preference", and the answer to that is the
      // campus feed — never the marketing page they just signed in from.
      return NextResponse.redirect(`${origin}${resolveLandingPath(rawNext, mongoUser.role)}`);
    }
  }

  // If code exchange failed or no code was provided
  return NextResponse.redirect(`${origin}/signin?reason=auth_failed`);
}
