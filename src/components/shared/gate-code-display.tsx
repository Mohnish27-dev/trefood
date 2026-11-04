import { cn } from "@/lib/utils";

/**
 * ★ The single loudest element in the product ★
 *
 * SYSTEM_ARCHITECTURE_AND_FLOWS.md section 6.
 *
 * The physical conditions this is read under decide every choice here:
 *
 *   · outdoors, at 1 AM, on a cracked screen, possibly in rain
 *   · by a student who has walked from their room and wants to leave
 *   · matched against four digits written on a packet in marker
 *
 * So: maximum size, maximum contrast, mono digits with generous tracking, a
 * glow that survives a low-brightness screen, and absolutely nothing else
 * competing for attention in the same frame.
 *
 * Digits are separated into individual cells because a single "4821" run is
 * harder to compare character-by-character against handwriting than four
 * discrete boxes are.
 */
export function GateCodeDisplay({
  code,
  size = "hero",
  label,
  className,
}: {
  code: string;
  /** `hero` for the student gate screen, `board` for the vendor's write-it-down moment. */
  size?: "hero" | "board" | "inline";
  label?: string;
  className?: string;
}) {
  const digits = code.split("");

  const cell =
    size === "hero"
      ? "h-24 w-[4.5rem] text-6xl sm:h-28 sm:w-20 sm:text-7xl"
      : size === "board"
        ? "h-20 w-16 text-5xl"
        : "h-11 w-9 text-2xl";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {label ? (
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted text-center">
          {label}
        </p>
      ) : null}

      <div
        className="flex gap-2 sm:gap-3"
        role="img"
        aria-label={`Gate code ${digits.join(" ")}`}
      >
        {digits.map((digit, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "gate-code gate-code-cell flex items-center justify-center font-bold tracking-normal select-none transition-all",
              // Light theme: crisp warm-white gradient surface, clean maroon border, soft elevation shadow, bold maroon digits
              "bg-gradient-to-b from-white to-[#fff8f5] border-2 border-tf-maroon/20 shadow-md shadow-tf-maroon/5 text-tf-maroon",
              // Dark theme: deep midnight background with glowing border & inset shadow
              "dark:from-transparent dark:to-transparent dark:bg-ink-deep dark:border-saffron/40 dark:shadow-[inset_0_0_30px_-10px] dark:shadow-saffron/40 dark:text-saffron-glow",
              size === "inline" ? "rounded-xl" : "rounded-2xl",
              cell,
            )}
          >
            {digit}
          </span>
        ))}
      </div>
    </div>
  );
}
