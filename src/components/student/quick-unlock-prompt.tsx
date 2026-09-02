"use client";

import { useEffect, useState } from "react";
import { KeyRound, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoredQuickUnlockProfile } from "@/lib/quick-unlock";
import { QuickUnlockModal } from "@/components/student/quick-unlock-modal";

const DISMISSED_KEY = "trefood.quick_unlock.dismissed";

export interface QuickUnlockPromptProps {
  user?: {
    _id: string;
    name: string;
    email: string;
    quickUnlock?: {
      pinHash?: string | null;
    } | null;
  } | null | undefined;
}

export function QuickUnlockPrompt({ user }: QuickUnlockPromptProps) {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // If no user or user already has a PIN configured in DB or local storage
    if (!user || user.quickUnlock?.pinHash) return undefined;

    try {
      const stored = getStoredQuickUnlockProfile();
      if (stored?.pinHash) return undefined;

      const dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
      if (!dismissed) {
        // Show with a slight delay so it doesn't collide with page entry
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors
    }
    return undefined;
  }, [user]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ignore
    }
  };

  if (!user || !visible) return null;

  return (
    <>
      <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-lg animate-rise rounded-2xl border border-saffron/40 bg-surface-raised p-3.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-saffron-wash border border-saffron/30 text-saffron">
            <KeyRound className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-semibold text-bone">
                Enable 1-Tap Quick Unlock
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-saffron/15 px-1.5 py-0.5 text-[9px] font-medium text-saffron">
                <Sparkles className="size-2.5" />
                Faster Orders
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              Set a 4-digit PIN or fingerprint on this phone to skip entering passwords every time you order.
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setVisible(false);
                  setModalOpen(true);
                }}
                className="h-8 text-xs font-semibold px-3"
              >
                Set up 4-Digit PIN
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 text-xs text-muted hover:text-bone"
              >
                Not now
              </Button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-faint hover:text-bone"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <QuickUnlockModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={user}
        onComplete={() => {
          setVisible(false);
          try {
            window.localStorage.setItem(DISMISSED_KEY, "1");
          } catch {
            // Ignore
          }
        }}
      />
    </>
  );
}
