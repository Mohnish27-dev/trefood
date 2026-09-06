"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleFavourite } from "@/server/actions/account";
import { cn } from "@/lib/utils";

/**
 * The heart on a restaurant.
 *
 * Optimistic, because the round trip is a database write on hostel wifi and a
 * heart that fills a second after the tap feels broken. If the server
 * disagrees, the returned truth wins and the heart snaps back rather than
 * lying quietly.
 *
 * Signed out, this is not disabled — it sends you to sign-in with a `next`
 * back to where you were. A greyed-out heart teaches nothing.
 */
export function FavouriteButton({
  restaurantId,
  restaurantName,
  initialFavourited,
  signedIn,
  variant = "overlay",
  className,
}: {
  restaurantId: string;
  restaurantName: string;
  initialFavourited: boolean;
  signedIn: boolean;
  /** `overlay` sits on a photo; `plain` sits on a surface. */
  variant?: "overlay" | "plain";
  className?: string;
}) {
  const router = useRouter();
  const [favourited, setFavourited] = useState(initialFavourited);
  const [pending, startTransition] = useTransition();

  const onClick = (event: React.MouseEvent): void => {
    // These sit on top of a card that is itself a link.
    event.preventDefault();
    event.stopPropagation();

    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const next = !favourited;
    setFavourited(next);

    startTransition(async () => {
      const result = await toggleFavourite({ restaurantId });
      if (result.status === "error") {
        setFavourited(!next);
        return;
      }
      if (typeof result.favourited === "boolean") setFavourited(result.favourited);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={favourited}
      aria-label={
        favourited
          ? `Remove ${restaurantName} from favourites`
          : `Add ${restaurantName} to favourites`
      }
      className={cn(
        "flex size-11 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-60",
        variant === "overlay"
          ? "bg-ink-deep/55 backdrop-blur-sm hover:bg-ink-deep/75"
          : "border border-line bg-surface-raised hover:bg-surface-hover",
        className,
      )}
    >
      <Heart
        className={cn(
          "size-5 transition-colors",
          favourited
            ? "fill-chili text-chili"
            : variant === "overlay"
              ? "text-white"
              : "text-muted",
        )}
      />
    </button>
  );
}
