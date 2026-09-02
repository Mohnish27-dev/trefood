import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  href?: string;
}

export function BrandLogo({
  size = "md",
  showText = true,
  className,
  href,
}: BrandLogoProps) {
  const iconSizes = {
    sm: "size-7",
    md: "size-9",
    lg: "size-12",
  };

  const imageDimension = {
    sm: 28,
    md: 36,
    lg: 48,
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  const content = (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl border border-saffron/20 shadow-sm transition-transform active:scale-95",
          iconSizes[size],
        )}
      >
        <Image
          src="/icons/icon-192.png"
          alt="TREFOOD Logo"
          width={imageDimension[size]}
          height={imageDimension[size]}
          className="size-full object-cover"
          priority
        />
      </div>
      {showText ? (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-bone",
            textSizes[size],
          )}
        >
          TREFOOD
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
