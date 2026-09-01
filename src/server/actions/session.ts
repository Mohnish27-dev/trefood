"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as db from "@/server/db/collections";
import { serverEnv } from "@/lib/env";
import { COOKIE_MAX_AGE_SECONDS } from "@/lib/cookies";
import { DEMO_USER_COOKIE } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string };

const demoSignInSchema = z.object({
  userId: z.string().min(1),
  redirectTo: z.string().optional(),
});

export async function signInAsDemoUser(input: unknown): Promise<AuthActionState> {
  const parsed = demoSignInSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Pick an account to continue." };

  if (serverEnv().AUTH_PROVIDER !== "stub") {
    return {
      status: "error",
      message: "Demo accounts are disabled. Sign in with Google or Email instead.",
    };
  }

  const user = await (await db.users()).findOne({ _id: parsed.data.userId });
  if (!user) return { status: "error", message: "That account no longer exists." };

  const store = await cookies();
  store.set(DEMO_USER_COOKIE, user._id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: serverEnv().NODE_ENV === "production",
  });

  const target = parsed.data.redirectTo;
  redirect(target && /^\/(?!\/)/.test(target) ? target : landingFor(user.role));
}

const emailPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  redirectTo: z.string().optional(),
});

export async function signInWithEmail(input: unknown): Promise<AuthActionState> {
  const parsed = emailPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const target = parsed.data.redirectTo;
  redirect(target && /^\/(?!\/)/.test(target) ? target : "/");
}

const signUpSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  redirectTo: z.string().optional(),
});

export async function signUpWithEmail(input: unknown): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.name,
        name: parsed.data.name,
      },
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  // If email confirmation is disabled or session is created immediately:
  if (data.session) {
    const target = parsed.data.redirectTo;
    redirect(target && /^\/(?!\/)/.test(target) ? target : "/");
  }

  return {
    status: "success",
    message: "Account created! Please check your email to confirm your account.",
  };
}

const otpSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  redirectTo: z.string().optional(),
});

export async function sendMagicLink(input: unknown): Promise<AuthActionState> {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const supabase = await createSupabaseServerClient();
  const target = parsed.data.redirectTo;
  const redirectUrl = target && /^\/(?!\/)/.test(target) ? target : "/";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Magic login link sent to your email! Check your inbox.",
  };
}

function landingFor(role: string): string {
  if (role === "VENDOR_OWNER" || role === "VENDOR_STAFF") return "/vendor/orders";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin/orders";
  return "/";
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);

  if (serverEnv().AUTH_PROVIDER === "supabase") {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Best-effort sign-out from Supabase
    }
  }

  redirect("/signin");
}
