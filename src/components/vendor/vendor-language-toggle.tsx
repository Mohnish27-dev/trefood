"use client";

import { useVendorLanguage } from "@/context/vendor-language-context";
import { cn } from "@/lib/utils";

interface VendorLanguageToggleProps {
  className?: string;
  showIcon?: boolean;
}

export function VendorLanguageToggle({ className }: VendorLanguageToggleProps) {
  const { language, setLanguage } = useVendorLanguage();

  return (
    <div
      role="group"
      aria-label="Choose language"
      className={cn(
        "inline-flex h-11 items-center rounded-xl border border-line bg-surface-raised/60 p-1 text-xs font-medium select-none",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={cn(
          "flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 transition-all",
          language === "en"
            ? "bg-surface-raised font-bold text-bone shadow-xs border border-line"
            : "text-muted hover:text-bone",
        )}
      >
        <span>English</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage("hi")}
        aria-pressed={language === "hi"}
        className={cn(
          "flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 transition-all",
          language === "hi"
            ? "bg-saffron/20 font-bold text-saffron shadow-xs border border-saffron/40"
            : "text-muted hover:text-bone",
        )}
      >
        <span>हिंदी</span>
      </button>
    </div>
  );
}
