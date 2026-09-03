import { cn } from "@/lib/utils";

/**
 * The square-in-a-square veg / non-veg mark.
 *
 * Legally required on Indian food packaging and menus, and genuinely
 * load-bearing for a large share of campus students. Green square for veg,
 * red triangle-in-square for non-veg, drawn rather than imaged so it is
 * crisp at any size and costs no network request.
 */
export function VegMark({ isVeg, className }: { isVeg: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px]",
        isVeg ? "veg-mark-veg border-mint" : "veg-mark-nonveg border-chili",
        className,
      )}
      style={{
        borderColor: isVeg ? "var(--theme-mint, #059669)" : "var(--theme-chili, #dc2626)",
      }}
    >
      {isVeg ? (
        <span
          className="size-2 rounded-full bg-mint"
          style={{ backgroundColor: "var(--theme-mint, #059669)" }}
        />
      ) : (
        <span
          className="size-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-chili"
          style={{ borderBottomColor: "var(--theme-chili, #dc2626)" }}
          aria-hidden
        />
      )}
    </span>
  );
}
