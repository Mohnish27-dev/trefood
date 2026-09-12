import type { Paise } from "./money";

/**
 * The one place a menu item's packing fee is read.
 *
 * Two fields carry it — a switch and an amount — and only the pair is
 * meaningful: an amount left behind by a vendor who later turned the fee off
 * must not be charged. Both are absent on items created before the feature,
 * which reads the same as "off".
 *
 * Deliberately dependency-free so the server pricing path, the vendor menu
 * screen and the student menu row can all agree on the same number.
 */
export function packingFeePaiseOf(item: {
  packingFeeEnabled?: boolean | undefined;
  packingFeePaise?: Paise | null | undefined;
}): Paise {
  if (item.packingFeeEnabled !== true) return 0;
  const fee = item.packingFeePaise ?? 0;
  if (!Number.isSafeInteger(fee) || fee <= 0) return 0;
  return fee;
}
