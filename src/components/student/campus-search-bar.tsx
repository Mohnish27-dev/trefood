"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, TrendingUp, UtensilsCrossed, X } from "lucide-react";

import { VegMark } from "@/components/shared/veg-mark";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  highlightParts,
  rankSuggestions,
  type CampusSearchIndex,
  type Suggestion,
} from "@/lib/dish-search";

interface CampusSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  index: CampusSearchIndex;
  /** Called the first time the box is focused, so the index can be fetched lazily. */
  onWake?: (() => void) | undefined;
  onSelect: (suggestion: Suggestion) => void;
  loading?: boolean;
}

/**
 * The campus search box, with Swiggy-style live suggestions.
 *
 * Two rules drive the design:
 *
 *   1. Every keystroke must repaint the list. Students type three letters and
 *      expect to see the dish, so ranking runs locally against a preloaded
 *      index — no request is made while typing.
 *   2. A suggestion is a DESTINATION, not a spelling aid. Tapping "Biryani"
 *      answers "which kitchens near my gate cook this", which is the question
 *      that was actually asked; it does not merely paste text into the box.
 */
export function CampusSearchBar({
  value,
  onChange,
  index,
  onWake,
  onSelect,
  loading = false,
}: CampusSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const suggestions = useMemo(() => rankSuggestions(index, value, 8), [index, value]);

  /**
   * The empty-query state. Popular dishes beat an empty panel: it teaches a
   * first-time student what the campus even sells, which is most of what a
   * "recent searches" list does on a mature app with no history to show.
   */
  const popular = useMemo(() => {
    if (value.trim().length > 0) return [];
    return [...index.dishes]
      .sort((a, b) => {
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        return b.restaurantIds.length - a.restaurantIds.length;
      })
      .slice(0, 6);
  }, [index.dishes, value]);

  const rows: Suggestion[] = value.trim().length > 0 ? suggestions : popular;

  // Close on an outside tap. Pointer events cover touch and mouse alike,
  // which matters because this is a PWA first and a desktop site second.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const choose = (suggestion: Suggestion) => {
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
    onSelect(suggestion);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "Enter") {
      const picked = activeIndex >= 0 ? rows[activeIndex] : undefined;
      event.preventDefault();
      if (picked) choose(picked);
      else {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (rows.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => (i + 1) % rows.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1));
    }
  };

  const showPanel = isOpen && (rows.length > 0 || value.trim().length > 0);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "relative flex h-11 sm:h-12 items-center rounded-2xl bg-white text-slate-900 px-4 shadow-md transition-all",
          showPanel && "rounded-b-none shadow-lg",
        )}
      >
        <Search className="size-4.5 text-slate-400 shrink-0 mr-2.5" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            // The list is about to be rebuilt, so the keyboard cursor no
            // longer points at the row the student was looking at.
            setActiveIndex(-1);
          }}
          onFocus={() => {
            onWake?.();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search for dishes, restaurants"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:outline-none"
          aria-label="Search for dishes"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full z-50 max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain rounded-b-2xl bg-white shadow-2xl ring-1 ring-black/5"
        >
          {value.trim().length === 0 && rows.length > 0 ? (
            <p className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <TrendingUp className="size-3" />
              Popular on campus
            </p>
          ) : null}

          {rows.map((suggestion, i) => (
            <SuggestionRow
              key={`${suggestion.kind}-${suggestion.name}`}
              id={`${listboxId}-option-${i}`}
              suggestion={suggestion}
              query={value}
              active={i === activeIndex}
              onPick={() => choose(suggestion)}
            />
          ))}

          {rows.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {loading
                  ? "Loading the campus menu..."
                  : `No match for “${value.trim()}”`}
              </p>
              {loading ? null : (
                <p className="mt-0.5 text-xs text-slate-500">
                  Try a shorter word, like “biryani” or “roll”.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SuggestionRow({
  id,
  suggestion,
  query,
  active,
  onPick,
}: {
  id: string;
  suggestion: Suggestion;
  query: string;
  active: boolean;
  onPick: () => void;
}) {
  const parts = highlightParts(suggestion.name, query);

  const subtitle =
    suggestion.kind === "dish"
      ? suggestion.restaurantIds.length === 1
        ? "Dish"
        : `Dish · ${suggestion.restaurantIds.length} restaurants`
      : suggestion.kind === "restaurant"
        ? `Restaurant · ${suggestion.cuisines.slice(0, 2).join(", ")}`
        : `Cuisine · ${suggestion.restaurantIds.length} place${
            suggestion.restaurantIds.length === 1 ? "" : "s"
          }`;

  const imageUrl = suggestion.kind === "cuisine" ? null : suggestion.imageUrl;

  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      // Pointer-down rather than click: on a phone the input's blur fires
      // first and would tear the panel down before a click could land.
      onPointerDown={(e) => {
        e.preventDefault();
        onPick();
      }}
      className={cn(
        "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-0",
        active ? "bg-slate-100" : "hover:bg-slate-50",
      )}
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
            unoptimized={imageUrl.startsWith("http")}
          />
        ) : (
          <UtensilsCrossed className="size-5 text-slate-400" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {suggestion.kind === "dish" ? (
            <VegMark isVeg={suggestion.isVeg} className="size-3.5" />
          ) : null}
          <span className="truncate text-[15px] leading-tight text-slate-900">
            {parts.map((part, i) => (
              <span key={i} className={part.match ? "font-bold" : "font-normal"}>
                {part.text}
              </span>
            ))}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>
      </span>

      {suggestion.kind === "dish" ? (
        <span className="tabular shrink-0 text-xs font-semibold text-slate-600">
          {formatINR(suggestion.fromPricePaise)}
        </span>
      ) : null}
    </button>
  );
}
