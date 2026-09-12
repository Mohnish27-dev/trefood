import { Package } from "lucide-react";

import { Money, MoneyRow } from "@/components/shared/money";

export interface PackingChargeLine {
  name: string;
  quantity: number;
  /** Packing for the whole line: the item's per-unit fee x quantity. */
  linePackingFeePaise: number;
}

/**
 * The packing line of a bill, itemised.
 *
 * Packing is set per item by the vendor, so one total on its own leaves a
 * student guessing which dish it came from. Every item that carries a fee is
 * listed under the total with its own share, so the cash they hand over at the
 * gate can be checked line by line. Renders nothing when no item charges one.
 */
export function PackingCharges({
  totalPaise,
  lines,
}: {
  totalPaise: number;
  lines: readonly PackingChargeLine[];
}) {
  if (totalPaise <= 0) return null;

  const charged = lines.filter((line) => line.linePackingFeePaise > 0);

  return (
    <div>
      <MoneyRow label="Packing charges" paise={totalPaise} />
      {charged.length > 0 ? (
        <ul className="mb-1 space-y-1 border-l border-line pl-3">
          {charged.map((line, i) => (
            <li
              key={`${line.name}-${i}`}
              className="flex items-baseline justify-between gap-3 text-xs text-faint"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Package className="size-3 shrink-0" />
                <span className="truncate">
                  {line.name}
                  {line.quantity > 1 ? (
                    <>
                      {" "}
                      <span className="tabular">
                        ({line.quantity} × <Money paise={line.linePackingFeePaise / line.quantity} />)
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <Money paise={line.linePackingFeePaise} className="shrink-0" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
