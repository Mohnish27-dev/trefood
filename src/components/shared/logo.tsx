import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showTagline?: boolean;
  tagline?: string;
  variant?: "light" | "on-maroon" | "auto";
  className?: string;
  href?: string;
}

/**
 * TreFood heart & sprout emblem (leaf person inside heart outline)
 */
export function TreFoodEmblem({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden="true"
    >
      {/* Outer Heart Shape */}
      <path
        d="M50 86 C24 67 12 49 12 32 C12 18 22 9 35 9 C42 9 47 13 50 18 C53 13 58 9 65 9 C78 9 88 18 88 32 C88 49 76 67 50 86 Z"
        stroke="#7CB342"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      {/* Head */}
      <circle cx="50" cy="35" r="5.5" fill="#7CB342" />
      {/* Left Leaf / Sprout Arm */}
      <path
        d="M50 56 C50 48 38 43 30 46 C34 53 43 55 50 56 Z"
        fill="#7CB342"
      />
      {/* Right Leaf / Sprout Arm */}
      <path
        d="M50 56 C50 48 62 43 70 46 C66 53 57 55 50 56 Z"
        fill="#7CB342"
      />
      {/* Central Sprout Stem */}
      <path
        d="M50 67 L50 46"
        stroke="#7CB342"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLogo({
  size = "md",
  showText = true,
  showTagline = false,
  tagline = "Food · Fruits · Groceries",
  variant = "auto",
  className,
  href,
}: BrandLogoProps) {
  const iconSizes = {
    sm: "size-7",
    md: "size-9",
    lg: "size-11",
    xl: "size-14",
  };

  const imageDimension = {
    sm: 28,
    md: 36,
    lg: 44,
    xl: 56,
  };

  const textSizes = {
    sm: "text-base tracking-tight",
    md: "text-xl tracking-tight",
    lg: "text-2xl tracking-tight",
    xl: "text-3xl tracking-tight",
  };

  const isDarkBg = variant === "on-maroon";

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* App Icon Tile */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-tf-maroon border border-white/20 shadow-sm transition-transform active:scale-95",
          iconSizes[size],
        )}
      >
        <Image
          src="/brand/trefood-brand-logo.jpg"
          alt="TreFood Logo"
          width={imageDimension[size]}
          height={imageDimension[size]}
          className="size-full object-cover"
          priority
        />
      </div>

      {/* Styled Wordmark */}
      {showText ? (
        <div className="flex flex-col justify-center leading-none">
          <div className={cn("flex items-baseline font-display font-extrabold", textSizes[size])}>
            <span
              className={cn(
                "transition-colors",
                isDarkBg ? "text-white" : "text-tf-maroon dark:text-white",
              )}
            >
              Tre
            </span>
            <div className="relative inline-flex items-baseline text-tf-yellow ml-0.5">
              <span>F</span>
              <span className="relative inline-block">
                {/* Sprout emblem positioned above the two 'oo's */}
                <TreFoodEmblem
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2",
                    size === "sm" && "-top-2.5 size-2.5",
                    size === "md" && "-top-3.5 size-3.5",
                    size === "lg" && "-top-4 size-4.5",
                    size === "xl" && "-top-5 size-5.5",
                  )}
                />
                <span>oo</span>
              </span>
              <span>d</span>
            </div>
          </div>

          {showTagline ? (
            <span
              className={cn(
                "text-[7px] sm:text-[8px] font-bold tracking-[0.14em] uppercase mt-0.5",
                isDarkBg ? "text-white/80" : "text-tf-maroon/80 dark:text-muted",
              )}
            >
              {tagline}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-opacity hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
}
