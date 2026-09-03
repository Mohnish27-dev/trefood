"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";

interface RestaurantCarouselProps {
  images: string[];
  restaurantName: string;
  etaLabel: string;
  isServingNow?: boolean;
}

export function RestaurantCarousel({
  images,
  restaurantName,
  etaLabel,
  isServingNow = true,
}: RestaurantCarouselProps) {
  const hasMultiple = images.length > 1;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // If there are multiple images, append a clone of the first image to allow seamless looping
  const firstImage = images[0];
  const slides: string[] = hasMultiple && firstImage ? [...images, firstImage] : images;

  useEffect(() => {
    if (!hasMultiple || isPaused) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, [hasMultiple, isPaused, images.length]);

  // Seamless forward loop handler
  const handleTransitionEnd = () => {
    if (!hasMultiple) return;

    // If we've slid to the cloned first slide (at index images.length)
    if (currentIndex >= images.length) {
      // Instantly reset to index 0 with transition turned off
      setIsTransitioning(false);
      setCurrentIndex(0);

      // Re-enable transition on the next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
      });
    }
  };

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const touchEndX = touch.clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 40 && hasMultiple) {
      if (diff > 0) {
        // Swiped left -> advance
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev + 1);
      } else if (currentIndex > 0) {
        // Swiped right -> go back
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev - 1);
      }
    }

    touchStartXRef.current = null;
    setIsPaused(false);
  };

  const activeDotIndex = images.length > 0 ? currentIndex % images.length : 0;

  // Fallback when no photos are uploaded yet
  if (images.length === 0) {
    return (
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-raised">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-surface via-surface-raised to-surface p-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface shadow-xs">
            <UtensilsCrossed className="size-6 text-muted" />
          </div>
          <span className="mt-2 font-display text-base font-semibold tracking-tight text-bone">
            {restaurantName}
          </span>
          <span className="text-[11px] text-faint">Photos coming soon</span>
        </div>
        <div className="absolute bottom-2.5 right-2.5 z-10 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
          {etaLabel}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[16/9] w-full overflow-hidden bg-surface-raised select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Slides Track ────────────────────────────────────────── */}
      <div
        className="flex h-full w-full"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
          transition: isTransitioning ? "transform 500ms ease-out" : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {slides.map((src, idx) => (
          <div key={`${src}-${idx}`} className="relative h-full w-full shrink-0">
            <Image
              src={src}
              alt={`${restaurantName} photo ${idx + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, 512px"
              className="object-cover"
              loading="eager"
              unoptimized
            />
          </div>
        ))}
      </div>

      {/* ── Top & Bottom Gradients ───────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* ── Carousel Indicator Dots (Top Center) ──────────────────── */}
      {hasMultiple ? (
        <div className="pointer-events-none absolute inset-x-0 top-2.5 z-10 flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === activeDotIndex
                  ? "h-1.5 w-4 bg-white shadow-sm"
                  : "h-1.5 w-1.5 bg-white/50 backdrop-blur-sm"
              }`}
            />
          ))}
        </div>
      ) : null}

      {/* ── ETA Badge (Bottom Right, matching reference photo) ─────── */}
      <div className="absolute bottom-2.5 right-2.5 z-10 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
        {etaLabel}
      </div>

      {/* ── Closed Overlay if not serving ─────────────────────────── */}
      {!isServingNow ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <span className="rounded-lg border border-line bg-surface/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-bone shadow">
            Closed Right Now
          </span>
        </div>
      ) : null}
    </div>
  );
}
