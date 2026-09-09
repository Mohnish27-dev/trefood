"use client";

import { Check, Loader2, MessageSquare, Sparkles, Star, ThumbsUp, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { submitOrderFeedback } from "@/server/actions/student";

const QUICK_TAGS = [
  "⚡ Fast delivery",
  "🍲 Hot & fresh",
  "📦 Neat packaging",
  "🤝 Polite rider",
  "😋 Delicious taste",
  "💰 Great value",
];

const RATING_LABELS: Record<number, { label: string; emoji: string }> = {
  1: { label: "Disappointing", emoji: "😞" },
  2: { label: "Could be better", emoji: "😐" },
  3: { label: "Good & satisfying", emoji: "🙂" },
  4: { label: "Very good", emoji: "😊" },
  5: { label: "Outstanding", emoji: "🤩" },
};

export interface SubmittedFeedback {
  rating: number;
  comment: string | null;
  tags?: string[];
  createdAt?: string;
}

interface OrderFeedbackProps {
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  existingFeedback?: SubmittedFeedback | null | undefined;
  onSuccess?: ((feedback: SubmittedFeedback) => void) | undefined;
  onDismiss?: (() => void) | undefined;
}

/**
 * Interactive Star Rating Bar with PWA-sized touch targets.
 */
export function StarRatingInput({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeRating = hovered ?? value;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Star rating from 1 to 5"
        className="flex items-center justify-center gap-1 sm:gap-2"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= activeRating;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              disabled={disabled}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "flex size-11 items-center justify-center rounded-xl transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron",
                "active:scale-90",
                filled
                  ? "text-saffron hover:scale-110"
                  : "text-muted hover:text-bone hover:scale-105",
                disabled && "opacity-60 cursor-not-allowed",
              )}
            >
              <Star
                className={cn(
                  "size-8 sm:size-9 transition-all duration-150",
                  filled
                    ? "fill-saffron text-saffron drop-shadow-[0_0_8px_rgba(245,158,11,0.45)]"
                    : "fill-transparent text-muted/50",
                )}
              />
            </button>
          );
        })}
      </div>

      <p className="h-6 text-xs sm:text-sm font-medium transition-opacity text-bone">
        {activeRating > 0 ? (
          <span className="inline-flex items-center gap-1.5 animate-fade-in text-saffron">
            <span>{RATING_LABELS[activeRating]?.emoji}</span>
            <span>{RATING_LABELS[activeRating]?.label}</span>
          </span>
        ) : (
          <span className="text-faint">Tap a star to rate</span>
        )}
      </p>
    </div>
  );
}

/**
 * Post-delivery feedback form content.
 */
export function OrderFeedbackForm({
  orderId,
  orderNumber,
  restaurantName,
  existingFeedback,
  onSuccess,
  onDismiss,
}: OrderFeedbackProps) {
  const [rating, setRating] = useState<number>(existingFeedback?.rating ?? 0);
  const [comment, setComment] = useState<string>(existingFeedback?.comment ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(existingFeedback?.tags ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedFeedback | null>(existingFeedback ?? null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (rating === 0) {
      setError("Please choose a star rating (1 to 5 stars).");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await submitOrderFeedback({
      orderId,
      rating,
      comment: comment.trim().length > 0 ? comment.trim() : null,
      tags: selectedTags,
    });

    if (result.status === "error") {
      setError(result.message);
      setSubmitting(false);
    } else if (result.status === "success") {
      setSubmitted(result.feedback);
      onSuccess?.(result.feedback);
      setSubmitting(false);
    }
  };

  // If already submitted and not in edit mode, display the summary card
  if (submitted && !submitting) {
    return (
      <div className="text-center py-3 space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-mint-wash/30 border border-mint/40 text-mint shadow-md">
          <Check className="size-6" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-bone">Thank you for your rating!</h3>
          <p className="text-xs text-muted mt-0.5">
            Your feedback helps {restaurantName} improve campus meals.
          </p>
        </div>

        {/* Display rating and tags */}
        <div className="flex items-center justify-center gap-1 py-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={cn(
                "size-5",
                s <= submitted.rating
                  ? "fill-saffron text-saffron"
                  : "fill-transparent text-muted/30",
              )}
            />
          ))}
          <span className="ml-1 text-xs font-bold text-bone">
            {submitted.rating}/5
          </span>
        </div>

        {submitted.tags && submitted.tags.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {submitted.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg border border-line bg-surface px-2 py-0.5 text-[11px] text-bone"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {submitted.comment ? (
          <p className="rounded-xl border border-line/60 bg-surface/50 p-3 text-left text-xs italic text-bone/90">
            &quot;{submitted.comment}&quot;
          </p>
        ) : null}

        <div className="pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSubmitted(null)}
            className="text-xs text-muted hover:text-bone"
          >
            Update review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {/* Header Info */}
      <div className="text-center pb-1">
        <p className="font-mono text-[11px] tracking-wider text-faint uppercase">
          {orderNumber}
        </p>
        <h2 className="font-display text-lg font-bold text-bone mt-0.5">
          How was your food from {restaurantName}?
        </h2>
        <p className="text-xs text-muted mt-1">
          Delivered to your gate. Tap a star to rate your meal.
        </p>
      </div>

      {/* Star Selector */}
      <div className="rounded-2xl border border-line/70 bg-surface/40 p-4">
        <StarRatingInput value={rating} onChange={(r) => { setRating(r); setError(null); }} />
      </div>

      {/* Quick Tags (Optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-bone flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-saffron" />
            What went well?
          </span>
          <span className="text-[10px] text-faint uppercase font-mono">Optional</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "inline-flex items-center rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-95",
                  isSelected
                    ? "border-saffron bg-saffron-wash/30 text-saffron font-semibold"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-bone",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Written Comment (Optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="feedback-comment" className="font-medium text-bone flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-mint" />
            Detailed feedback
          </label>
          <span className="text-[10px] text-faint uppercase font-mono">Optional</span>
        </div>
        <div className="relative">
          <textarea
            id="feedback-comment"
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about the food taste, temperature, packaging, or rider experience..."
            className={cn(
              "w-full resize-none rounded-xl border border-line bg-surface p-3 text-xs sm:text-sm text-bone",
              "placeholder:text-faint/80 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron",
            )}
          />
          <span className="absolute bottom-2 right-2.5 font-mono text-[10px] text-faint">
            {comment.length}/500
          </span>
        </div>
      </div>

      {/* Error display */}
      {error ? (
        <p className="rounded-xl border border-chili/30 bg-chili-wash px-3 py-2 text-xs text-chili">
          {error}
        </p>
      ) : null}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 pb-safe">
        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onDismiss}
            disabled={submitting}
            className="flex-1 text-xs sm:text-sm text-muted hover:text-bone"
          >
            Maybe later
          </Button>
        ) : null}
        <Button
          type="submit"
          size="md"
          variant="primary"
          disabled={submitting || rating === 0}
          className="flex-1 font-semibold text-xs sm:text-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <ThumbsUp className="size-4" />
              Submit Review
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

/**
 * PWA-Optimized Feedback Modal (Bottom Sheet on Mobile, Centered Modal on Desktop).
 */
export function OrderFeedbackDialog({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  restaurantName,
  existingFeedback,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  existingFeedback?: SubmittedFeedback | null;
  onSuccess?: (feedback: SubmittedFeedback) => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-dialog-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-ink-deep/80 backdrop-blur-sm transition-opacity"
      />

      {/* PWA Sheet / Modal Card */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg bg-surface-raised border border-line-strong",
          // Mobile PWA ergonomics: rounded top corners, docked to bottom with safe-area
          "rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl",
          "animate-rise max-h-[90dvh] overflow-y-auto",
        )}
      >
        {/* Mobile handle indicator */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl text-faint hover:bg-surface hover:text-bone active:scale-95 transition-colors"
          aria-label="Close feedback form"
        >
          <X className="size-4" />
        </button>

        <OrderFeedbackForm
          orderId={orderId}
          orderNumber={orderNumber}
          restaurantName={restaurantName}
          existingFeedback={existingFeedback}
          onSuccess={(fb) => {
            onSuccess?.(fb);
            // Auto close dialog after brief delay on success
            setTimeout(() => onClose(), 1200);
          }}
          onDismiss={onClose}
        />
      </div>
    </div>
  );
}

/**
 * Inline Feedback Card displayed on the Order Tracker after delivery.
 */
export function OrderFeedbackCard({
  orderId,
  orderNumber,
  restaurantName,
  existingFeedback,
  onUpdateFeedback,
}: {
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  existingFeedback?: SubmittedFeedback | null;
  onUpdateFeedback?: (feedback: SubmittedFeedback) => void;
}) {
  const [feedback, setFeedback] = useState<SubmittedFeedback | null>(existingFeedback ?? null);
  const [showDialog, setShowDialog] = useState(false);

  const handleSuccess = (newFeedback: SubmittedFeedback) => {
    setFeedback(newFeedback);
    onUpdateFeedback?.(newFeedback);
  };

  return (
    <>
      <Card className="border-saffron/30 bg-surface-raised p-4 transition-all">
        {feedback ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-saffron">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "size-3.5",
                      s <= feedback.rating
                        ? "fill-saffron text-saffron"
                        : "fill-transparent text-muted/30",
                    )}
                  />
                ))}
                <span className="ml-1 text-xs font-bold text-bone">
                  {feedback.rating}.0
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted truncate">
                {feedback.comment ? `"${feedback.comment}"` : "You rated this order"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDialog(true)}
              className="shrink-0 text-xs text-muted hover:text-bone"
            >
              Edit
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-bone flex items-center gap-1.5">
                <Sparkles className="size-4 text-saffron" />
                Rate your meal
              </p>
              <p className="mt-0.5 text-xs text-muted">
                How was the food from {restaurantName}?
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowDialog(true)}
              className="shrink-0 font-medium text-xs"
            >
              <Star className="size-3.5 fill-ink" />
              Rate now
            </Button>
          </div>
        )}
      </Card>

      <OrderFeedbackDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        orderId={orderId}
        orderNumber={orderNumber}
        restaurantName={restaurantName}
        existingFeedback={feedback}
        onSuccess={handleSuccess}
      />
    </>
  );
}
