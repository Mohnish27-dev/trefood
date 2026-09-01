import { cn } from "@/lib/utils";

interface GateCodeDisplayProps {
  /** Four digits. Absent from the student's payload until AT_GATE — by design. */
  code: string;
  label?: string;
  className?: string;
}

/**
 * The four-digit packet code, rendered at the size it actually needs to be.
 *
 * This is the highest-stakes piece of type in the product. It is read outdoors, at
 * 1 AM, at arm's length, on a cracked screen, by someone walking — and it is compared
 * against digits written in marker on a paper bag. Everything here serves that:
 *
 *   - `text-gate-code` is 4.5rem with wide tracking, so the digits do not merge.
 *   - `tabular-nums` keeps each digit the same width, so 1 and 4 read alike.
 *   - The digits are spaced individually, because a student reads them out loud
 *     one at a time when comparing against the packet.
 *
 * Digits only, never letters — there is no 0/O ambiguity to resolve under a hostel
 * light (docs/FAILURES_AND_EDGE_CASES.md §5.2).
 */
export function GateCodeDisplay({
  code,
  label = "Code on your packet",
  className,
}: GateCodeDisplayProps) {
  return (
    <div
      className={cn(
        "border-status-gate/40 bg-status-gate/5 flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-6",
        className,
      )}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className="text-gate-code text-status-gate flex gap-3 tabular-nums"
        // Read out as separate digits by a screen reader, not as "four thousand".
        aria-label={code.split("").join(" ")}
      >
        {code.split("").map((digit, index) => (
          <span key={index}>{digit}</span>
        ))}
      </p>
    </div>
  );
}
