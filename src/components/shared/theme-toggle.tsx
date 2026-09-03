"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "icon" | "pill" | "row";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, toggleTheme, isLoaded } = useTheme();
  const isDark = theme === "dark";

  if (variant === "row") {
    return (
      <div
        className={cn(
          "flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised border border-line text-bone">
            {isLoaded ? (
              isDark ? (
                <Moon className="size-4 text-saffron" />
              ) : (
                <Sun className="size-4 text-amber" />
              )
            ) : (
              <span className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <span className="block text-sm font-medium text-bone">Appearance</span>
            <span className="block truncate text-xs text-muted">
              {isLoaded ? (isDark ? "Dark theme active" : "Light theme active") : "Theme"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-raised px-3.5 py-2 text-xs font-medium text-bone transition-all hover:bg-surface-hover active:scale-95"
        >
          {isLoaded ? (
            <>
              {isDark ? <Sun className="size-3.5 text-amber" /> : <Moon className="size-3.5 text-saffron" />}
              <span>{isDark ? "Switch to Light" : "Switch to Dark"}</span>
            </>
          ) : (
            <span className="h-3.5 w-16" />
          )}
        </button>
      </div>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-medium text-bone transition-all hover:border-saffron/40 hover:bg-surface-raised active:scale-95",
          className,
        )}
      >
        <div className="relative size-4">
          <Sun
            className={cn(
              "absolute inset-0 size-4 text-amber transition-all duration-300",
              isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
          />
          <Moon
            className={cn(
              "absolute inset-0 size-4 text-saffron transition-all duration-300",
              isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
            )}
          />
        </div>
        <span>{isDark ? "Dark" : "Light"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-all hover:border-saffron/40 hover:bg-surface-raised hover:text-bone active:scale-95",
        className,
      )}
    >
      <Sun
        className={cn(
          "absolute size-[1.125rem] text-amber transition-all duration-300",
          isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute size-[1.125rem] text-saffron transition-all duration-300",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
        )}
      />
    </button>
  );
}
