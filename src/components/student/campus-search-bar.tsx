"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, SlidersHorizontal, TrendingUp, UtensilsCrossed, X } from "lucide-react";

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
  onWake?: (() => void) | undefined;
  onSelect: (suggestion: Suggestion) => void;
  loading?: boolean;
}

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

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1 < rows.length ? current + 1 : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current - 1 >= 0 ? current - 1 : rows.length - 1));
      return;
    }
  };

  const showPanel = isOpen && (rows.length > 0 || value.trim().length > 0);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          "relative flex h-12 items-center rounded-full bg-white text-slate-900 px-4.5 shadow-md border border-black/5 transition-all",
          showPanel && "rounded-b-none shadow-xl border-b-0",
        )}
      >
        <Search className="size-4.5 text-slate-400 shrink-0 mr-3" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            onWake?.();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search for food, fruits, groceries..."
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
          aria-label="Search for food, fruits, groceries"
        />

        <div className="flex items-center gap-2">
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              className="flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}

          <div className="h-4 w-px bg-slate-200" />
          <button
            type="button"
            className="flex items-center justify-center p-1 text-slate-500 hover:text-tf-maroon transition-colors cursor-pointer"
            aria-label="Filter"
            onClick={() => {
              onWake?.();
              setIsOpen(true);
            }}
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>
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
              <TrendingUp className="size-3 text-tf-maroon" />
              Popular on campus
            </p>
          ) : null}

          {rows.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              {loading ? (
                <span>Checking dishes across campus kitchens…</span>
              ) : (
                <span>
                  No dishes match &ldquo;{value}&rdquo;. Press Enter to search kitchen names.
                </span>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const isActive = idx === activeIndex;
                if (row.kind === "dish") {
                  return (
                    <li
                      key={`dish-${row.name}`}
                      id={`${listboxId}-option-${idx}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => choose(row)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors",
                        isActive ? "bg-tf-maroon/5 text-tf-maroon" : "hover:bg-slate-50 text-slate-800",
                      )}
                    >
                      <VegMark isVeg={row.isVeg} className="size-3.5" />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {highlightParts(row.name, value).map((part, pIdx) =>
                            part.match ? (
                              <mark
                                key={pIdx}
                                className="bg-transparent font-black text-tf-maroon"
                              >
                                {part.text}
                              </mark>
                            ) : (
                              <span key={pIdx}>{part.text}</span>
                            ),
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {row.restaurantIds.length} canteen
                          {row.restaurantIds.length === 1 ? "" : "s"} · from{" "}
                          <span className="font-semibold text-slate-800">
                            {formatINR(row.fromPricePaise)}
                          </span>
                        </p>
                      </div>

                      {row.imageUrl ? (
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          <Image
                            src={row.imageUrl}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized={!row.imageUrl.startsWith("/")}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                }

                if (row.kind === "restaurant") {
                  return (
                    <li
                      key={`r-${row.id}`}
                      id={`${listboxId}-option-${idx}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => choose(row)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors",
                        isActive ? "bg-tf-maroon/5 text-tf-maroon" : "hover:bg-slate-50 text-slate-800",
                      )}
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-tf-maroon/10 text-tf-maroon">
                        <UtensilsCrossed className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {row.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {row.cuisines.join(", ")}
                        </p>
                      </div>
                    </li>
                  );
                }

                return null;
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
