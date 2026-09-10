"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The six-digit code box.
 *
 * One input per digit, because a single text field on a phone gives you the
 * wrong keyboard, no per-digit feedback, and an autofill that fights you. The
 * details that matter are the ones people notice only when they are missing:
 * paste fills all six, backspace on an empty box steps back, and the browser's
 * own SMS/email code suggestion targets the first box via autoComplete.
 */

const LENGTH = 6;

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the sixth digit lands, so the form can submit itself. */
  onComplete?: ((value: string) => void) | undefined;
  disabled?: boolean | undefined;
  autoFocus?: boolean | undefined;
}

export function OtpCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
}: OtpCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState<number | null>(null);

  const digits = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
  };

  const handleInput = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;

    // A paste lands in whichever box had focus; spread it from there.
    if (typed.length > 1) {
      const merged = (value.slice(0, index) + typed).slice(0, LENGTH);
      commit(merged);
      refs.current[Math.min(merged.length, LENGTH - 1)]?.focus();
      return;
    }

    const chars = value.padEnd(LENGTH, " ").split("");
    chars[index] = typed;
    commit(chars.join("").trimEnd());

    if (index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const chars = value.padEnd(LENGTH, " ").split("");

      if (chars[index] && chars[index] !== " ") {
        chars[index] = " ";
        onChange(chars.join("").replace(/\s+$/, ""));
        return;
      }
      // Already empty: step back and clear the previous digit, which is what
      // a person means by pressing backspace twice in a row.
      if (index > 0) {
        chars[index - 1] = " ";
        onChange(chars.join("").replace(/\s+$/, ""));
        refs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          // Only the first box claims the one-time-code hint. On all six, some
          // browsers fill every box with the whole code.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH}
          value={digit.trim()}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => {
            setFocused(index);
            event.target.select();
          }}
          onBlur={() => setFocused(null)}
          className={[
            "h-14 w-full min-w-0 rounded-xl border bg-surface/90 text-center font-mono text-xl font-bold text-bone",
            "transition-all focus:outline-none disabled:opacity-50",
            focused === index
              ? "border-saffron ring-1 ring-saffron"
              : digit.trim()
                ? "border-saffron/50"
                : "border-line/80",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
