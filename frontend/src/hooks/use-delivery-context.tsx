"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";

interface DeliverySelection {
  campusSlug: string | null;
  zoneId: string | null;
}

interface DeliveryContextValue extends DeliverySelection {
  setCampus: (campusSlug: string) => void;
  setZone: (zoneId: string) => void;
  isHydrated: boolean;
}

const EMPTY: DeliverySelection = { campusSlug: null, zoneId: null };

const DeliveryContext = createContext<DeliveryContextValue | null>(null);

/**
 * Where the student is ordering to. Persisted, and remembered across visits.
 *
 * Both values live in one context because they are one decision. Choosing a campus
 * invalidates the zone — a Ganga Hostel gate means nothing at another campus — so
 * setting the campus clears the zone rather than leaving a stale pairing that would
 * quietly filter the restaurant list against a gate that does not exist.
 */
export function DeliveryProvider({ children }: { children: ReactNode }) {
  const { value, setValue, isHydrated } = useLocalStorage<DeliverySelection>(
    "trefood.delivery",
    EMPTY,
  );

  const setCampus = useCallback(
    (campusSlug: string) => {
      setValue((current) =>
        current.campusSlug === campusSlug
          ? current
          : // A zone belongs to a campus. Changing one must not keep the other.
            { campusSlug, zoneId: null },
      );
    },
    [setValue],
  );

  const setZone = useCallback(
    (zoneId: string) => setValue((current) => ({ ...current, zoneId })),
    [setValue],
  );

  const contextValue = useMemo(
    () => ({ ...value, setCampus, setZone, isHydrated }),
    [value, setCampus, setZone, isHydrated],
  );

  return <DeliveryContext value={contextValue}>{children}</DeliveryContext>;
}

export function useDelivery(): DeliveryContextValue {
  const context = useContext(DeliveryContext);
  if (context === null) {
    throw new Error("useDelivery must be used inside <DeliveryProvider>");
  }
  return context;
}
