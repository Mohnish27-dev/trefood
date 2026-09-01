"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { signInWithEmail, signUpWithEmail, sendMagicLink } from "@/server/actions/session";

interface StudentAuthFormProps {
  redirectTo: string | null;
}

type AuthMode = "signin" | "signup" | "magic";

export function StudentAuthForm({ redirectTo }: StudentAuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const target = redirectTo && /^\/(?!\/)/.test(redirectTo) ? redirectTo : "/";
      const redirectCallback = `${origin}/auth/callback?next=${encodeURIComponent(target)}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectCallback,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initialize Google login.");
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const res = await signInWithEmail({
          email,
          password,
          ...(redirectTo ? { redirectTo } : {}),
        });
        if (res.status === "error") {
          setError(res.message);
          setLoading(false);
        }
      } else if (mode === "signup") {
        const res = await signUpWithEmail({
          name,
          email,
          password,
          ...(redirectTo ? { redirectTo } : {}),
        });
        if (res.status === "error") {
          setError(res.message);
        } else if (res.status === "success") {
          setSuccessMessage(res.message ?? "Account created successfully!");
        }
        setLoading(false);
      } else if (mode === "magic") {
        const res = await sendMagicLink({
          email,
          ...(redirectTo ? { redirectTo } : {}),
        });
        if (res.status === "error") {
          setError(res.message);
        } else if (res.status === "success") {
          setSuccessMessage(res.message ?? "Check your email for the magic login link!");
        }
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication request failed.");
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* ── Google OAuth Button ────────────────────────────────────── */}
      <Button
        type="button"
        variant="secondary"
        block
        size="lg"
        disabled={googleLoading || loading}
        onClick={() => void handleGoogleSignIn()}
        className="relative bg-surface hover:bg-surface-raised border border-line"
      >
        {googleLoading ? (
          <Loader2 className="size-5 animate-spin text-saffron" />
        ) : (
          <GoogleIcon className="size-5 shrink-0" />
        )}
        <span className="font-medium text-bone">Continue with Google</span>
      </Button>

      {/* ── Divider ────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-line" />
        <span className="absolute bg-ink px-3 text-xs uppercase tracking-wider text-faint">
          or with email
        </span>
      </div>

      {/* ── Mode selector ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 border border-line">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setSuccessMessage(null);
          }}
          className={`rounded-lg py-2 text-xs font-medium transition-colors ${
            mode === "signin"
              ? "bg-surface-raised text-bone shadow-sm"
              : "text-muted hover:text-bone"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setSuccessMessage(null);
          }}
          className={`rounded-lg py-2 text-xs font-medium transition-colors ${
            mode === "signup"
              ? "bg-surface-raised text-bone shadow-sm"
              : "text-muted hover:text-bone"
          }`}
        >
          Sign up
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setError(null);
            setSuccessMessage(null);
          }}
          className={`rounded-lg py-2 text-xs font-medium transition-colors ${
            mode === "magic"
              ? "bg-surface-raised text-bone shadow-sm"
              : "text-muted hover:text-bone"
          }`}
        >
          Magic link
        </button>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────── */}
      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-chili/30 bg-chili-wash p-3.5 text-xs text-chili">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-mint/30 bg-mint-wash p-3.5 text-xs text-mint">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {/* ── Email Form ─────────────────────────────────────────────── */}
      <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
        {mode === "signup" ? (
          <div>
            <Label htmlFor="auth-name">Your Full Name</Label>
            <Input
              id="auth-name"
              type="text"
              placeholder="e.g. Aarav Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading || googleLoading}
            />
          </div>
        ) : null}

        <div>
          <Label htmlFor="auth-email">Student / College Email</Label>
          <Input
            id="auth-email"
            type="email"
            placeholder="e.g. student@nitp.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || googleLoading}
          />
        </div>

        {mode !== "magic" ? (
          <div>
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading || googleLoading}
            />
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          block
          size="lg"
          disabled={loading || googleLoading}
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : mode === "signin" ? (
            <ShieldCheck className="size-5" />
          ) : mode === "signup" ? (
            <Sparkles className="size-5" />
          ) : (
            <Mail className="size-5" />
          )}
          <span>
            {loading
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in to TREFOOD"
                : mode === "signup"
                  ? "Create Student Account"
                  : "Send Magic Login Link"}
          </span>
        </Button>
      </form>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
