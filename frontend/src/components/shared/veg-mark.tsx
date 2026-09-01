import { cn } from "@/lib/utils";

interface VegMarkProps {
  isVeg: boolean;
  className?: string;
}

/**
 * The FSSAI veg / non-veg mark: a dot inside a square outline, green for vegetarian
 * and red-brown for non-vegetarian.
 *
 * Worth rendering properly rather than as a coloured word. Indian diners read this
 * symbol before they read the item name, and for many of them it is the only piece
 * of the menu that is non-negotiable.
 */
export function VegMark({ isVeg, className }: VegMarkProps) {
  const label = isVeg ? "Vegetarian" : "Non-vegetarian";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[2px] border-[1.5px]",
        isVeg ? "border-veg" : "border-non-veg",
        className,
      )}
    >
      <span
        className={cn("size-2 rounded-full", isVeg ? "bg-veg" : "bg-non-veg")}
      />
    </span>
  );
}
