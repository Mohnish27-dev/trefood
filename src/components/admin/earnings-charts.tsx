"use client";

import { useEffect, useRef, useState } from "react";

import { formatINR, formatINRAxis, type Paise } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The chart primitives behind the earnings dashboard. Inline SVG, no library.
 *
 * A charting dependency would be the single largest thing in the admin bundle,
 * for three charts that never change shape. These are drawn by hand instead,
 * against the same tokens as the rest of the product, so they theme with it
 * rather than needing a parallel palette that drifts.
 *
 * Rules these follow, and the reasons they are rules:
 *
 *   · ONE Y-AXIS, ALWAYS. Two measures on two scales invent a correlation that
 *     is not in the data. Cash and commission never share a plot here; they get
 *     separate charts.
 *   · Colour follows the entity, never its rank. The vendor bars are all one
 *     hue: length already encodes magnitude, and re-colouring by rank would
 *     repaint every bar the moment somebody changes the month.
 *   · Status colour means status. Mint is collected, amber is owed, chili is
 *     unbilled — the same meanings they carry everywhere else in TREFOOD.
 *   · Every value is reachable without hover. Tooltips enhance; the table under
 *     the charts is the accessible twin, and it is not optional.
 *  
 * Sizing is measured rather than scaled: a `viewBox` stretched to fit would
 * distort stroke widths and blow the tick text up on a wide monitor.
 */

/**
 * Whole percentages for the share labels.
 *
 * A formatter rather than `Math.round`, which this codebase bans outright —
 * see the rule in `eslint.config.mjs`. Percentages are not money, but keeping
 * one habit for "turn a number into a label" is why the ban works.
 */
const WHOLE_PERCENT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/* ══════════════════════════════════════════════════════════════════════
   Measurement
   ══════════════════════════════════════════════════════════════════════ */

/** Renders at true pixel width, so 1 SVG unit is 1 device-independent pixel. */
function useMeasuredWidth(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/* ══════════════════════════════════════════════════════════════════════
   Daily trend — one series, area + line, crosshair
   ══════════════════════════════════════════════════════════════════════ */

export interface TrendPoint {
  date: string;
  valuePaise: Paise;
  orderCount: number;
}

/**
 * Commission earned per campus-local day.
 *
 * Single series on purpose. The obvious "improvement" is to overlay cash
 * collected, but cash is roughly ten times commission, so one of the two would
 * be a flat line along an axis — or it would need a second scale, which is the
 * one thing a chart must never have.
 */
export function TrendChart({
  points,
  label,
  emptyMessage,
}: {
  points: TrendPoint[];
  label: string;
  emptyMessage: string;
}) {
  const [ref, width] = useMeasuredWidth(720);
  const [hover, setHover] = useState<number | null>(null);

  const height = 200;
  // Left gutter carries the tick labels; the bottom band carries the dates.
  // Sizing the box to include them is what stops the card growing a nested
  // scrollbar to reveal its own axis.
  const pad = { top: 16, right: 12, bottom: 26, left: 52 };
  const plotWidth = Math.max(width - pad.left - pad.right, 10);
  const plotHeight = height - pad.top - pad.bottom;

  const max = Math.max(...points.map((p) => p.valuePaise), 1);
  const ceiling = niceCeiling(max);
  const hasData = points.some((point) => point.valuePaise > 0);

  const x = (index: number): number =>
    points.length <= 1
      ? pad.left + plotWidth / 2
      : pad.left + (index / (points.length - 1)) * plotWidth;
  const y = (paise: number): number => pad.top + plotHeight - (paise / ceiling) * plotHeight;

  const line = points.map((point, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(point.valuePaise)}`);
  const area = [
    ...line,
    `L${x(points.length - 1)},${pad.top + plotHeight}`,
    `L${x(0)},${pad.top + plotHeight}`,
    "Z",
  ];

  const peakIndex = points.reduce(
    (best, point, i) => (point.valuePaise > (points[best]?.valuePaise ?? -1) ? i : best),
    0,
  );
  const active = hover ?? null;
  const activePoint = active === null ? null : points[active];

  return (
    <div ref={ref} className="relative w-full">
      {hasData ? null : (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-xs text-faint">
          {emptyMessage}
        </p>
      )}

      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. Peak ${formatINR(points[peakIndex]?.valuePaise ?? 0)} on ${shortDate(points[peakIndex]?.date ?? "")}. Full figures in the table below.`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="trend-wash" x1="0" y1="0" x2="0" y2="1">
            {/* A wash, never a saturated block — the line is the data, the
                fill only gives it a body to sit on. */}
            <stop offset="0%" stopColor="var(--color-saffron)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-saffron)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines: hairline, solid, one step off the surface. Dashes read as
            a threshold the data does not have. */}
        {[0, 0.5, 1].map((fraction) => {
          const gridY = pad.top + plotHeight * (1 - fraction);
          return (
            <g key={fraction}>
              <line
                x1={pad.left}
                y1={gridY}
                x2={pad.left + plotWidth}
                y2={gridY}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={gridY + 3.5}
                textAnchor="end"
                className="fill-faint text-[10px] tabular"
              >
                {/* Truncated, not rounded: a tick is a label for a gridline
                    that is already drawn, and the paise formatter refuses a
                    fractional input by design. */}
                {formatINRAxis(Math.trunc(ceiling * fraction))}
              </text>
            </g>
          );
        })}

        {hasData ? (
          <>
            <path d={area.join(" ")} fill="url(#trend-wash)" />
            <path
              d={line.join(" ")}
              fill="none"
              stroke="var(--color-saffron)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {/* Date band. Only the ends and the middle are labelled: a tick under
            every one of thirty days is unreadable at this width. */}
        {points.map((point, i) =>
          i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2) ? (
            <text
              key={point.date}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-faint text-[10px]"
            >
              {shortDate(point.date)}
            </text>
          ) : null,
        )}

        {/* Crosshair and the hovered marker. The 2px surface ring keeps the dot
            legible where it sits on top of the line. */}
        {activePoint && hasData ? (
          <g>
            <line
              x1={x(active ?? 0)}
              y1={pad.top}
              x2={x(active ?? 0)}
              y2={pad.top + plotHeight}
              stroke="var(--color-line-strong)"
              strokeWidth={1}
            />
            <circle
              cx={x(active ?? 0)}
              cy={y(activePoint.valuePaise)}
              r={5}
              fill="var(--color-saffron)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </g>
        ) : null}

        {/* One hit band per point, each at least the finger-sized minimum, so a
            value never demands a pixel-perfect landing. */}
        {points.map((point, i) => (
          <rect
            key={point.date}
            x={x(i) - Math.max(plotWidth / points.length, 24) / 2}
            y={pad.top}
            width={Math.max(plotWidth / points.length, 24)}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {activePoint ? (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-xl border border-line bg-surface-raised px-2.5 py-1.5 shadow-lg"
          style={{
            left: clamp(x(active ?? 0), 70, Math.max(width - 70, 70)),
            top: 0,
          }}
        >
          <p className="text-[10px] whitespace-nowrap text-faint">{shortDate(activePoint.date)}</p>
          <p className="text-xs font-semibold whitespace-nowrap text-bone tabular">
            {formatINR(activePoint.valuePaise)}
          </p>
          <p className="text-[10px] whitespace-nowrap text-muted">
            {activePoint.orderCount} order{activePoint.orderCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Ranked vendor bars
   ══════════════════════════════════════════════════════════════════════ */

export interface RankedBar {
  id: string;
  name: string;
  valuePaise: Paise;
  /** Rendered under the name. Order count, share, whatever the caller needs. */
  caption: string;
}

/**
 * Vendors ranked by contribution.
 *
 * Every bar is the same hue. Fading them by rank would double-encode length as
 * colour — and worse, it would repaint every surviving bar whenever the filter
 * above changes the ranking, so a reader who learned "the tall orange one is
 * Swanzon" gets quietly lied to.
 */
export function RankedBars({ bars, emptyMessage }: { bars: RankedBar[]; emptyMessage: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...bars.map((bar) => bar.valuePaise), 1);

  if (bars.length === 0 || max <= 1) {
    return <p className="py-10 text-center text-xs text-faint">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {bars.map((bar) => {
        const share = (bar.valuePaise / max) * 100;
        return (
          <li
            key={bar.id}
            // The row is the hit target, not the bar — a 10px-wide bar for a
            // quiet vendor would otherwise be almost impossible to hover.
            className="group -mx-1.5 cursor-default rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-raised/50"
            onMouseEnter={() => setHover(bar.id)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-xs font-medium text-bone">{bar.name}</p>
              <p className="shrink-0 text-xs font-semibold text-bone tabular">
                {formatINR(bar.valuePaise)}
              </p>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              {/* Track and fill. 8px is inside the 24px cap, and the rounded
                  data-end sits at the tip while the origin stays square. */}
              <div className="h-2 flex-1 overflow-hidden rounded-l-[1px] rounded-r bg-surface-raised">
                <div
                  className={cn(
                    "h-full rounded-l-[1px] rounded-r bg-saffron transition-all duration-300",
                    hover === bar.id ? "opacity-100" : "opacity-85",
                  )}
                  style={{ width: `${Math.max(share, 1.5)}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-[10px] text-faint tabular">
                {WHOLE_PERCENT.format(share)}%
              </span>
            </div>

            <p className="mt-0.5 text-[10px] text-faint">{bar.caption}</p>
          </li>
        );
      })}
    </ul>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Collection meter
   ══════════════════════════════════════════════════════════════════════ */

export interface MeterSegment {
  key: string;
  label: string;
  paise: Paise;
  tone: "collected" | "outstanding" | "unbilled";
  hint: string;
}

const TONE_FILL: Record<MeterSegment["tone"], string> = {
  collected: "bg-mint",
  outstanding: "bg-amber",
  unbilled: "bg-chili",
};

const TONE_DOT: Record<MeterSegment["tone"], string> = {
  collected: "bg-mint",
  outstanding: "bg-amber",
  unbilled: "bg-chili",
};

/**
 * Where the collectable commission currently stands.
 *
 * ★ THESE SEGMENTS DO NOT SUM TO COMMISSION EARNED, AND MUST NOT CLAIM TO. ★
 *
 * The obvious reading — that every rupee earned is either collected, owed, or
 * not yet invoiced — is wrong, and the live data says so. Two rules in
 * `settlement.ts` bend it on purpose: a due under the ₹100 collection floor
 * rolls into tomorrow instead of being invoiced, and a ledger credit reduces
 * the due without touching the commission it was charged on. Both leave
 * commission that was genuinely earned outside all three segments.
 *
 * So this answers "what can we collect, and what state is it in" rather than
 * "where did the money go". The segments are shares of the collectable total,
 * and the copy around them says so.
 *
 * Colour is status, so it ships with a written label and a value beside every
 * swatch. Nothing here is legible by hue alone, which is what keeps it honest
 * under colour-vision deficiency and in greyscale print.
 */
export function CollectionMeter({ segments }: { segments: MeterSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.paise, 0);

  return (
    <div>
      {/* The 2px gaps are the surface doing the separating. A stroke around
          each segment would add ink that is not data. */}
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-surface-raised">
        {total === 0
          ? null
          : segments
              .filter((segment) => segment.paise > 0)
              .map((segment) => (
                <div
                  key={segment.key}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full", TONE_FILL[segment.tone])}
                  style={{ width: `${(segment.paise / total) * 100}%` }}
                  title={`${segment.label}: ${formatINR(segment.paise)}`}
                />
              ))}
      </div>

      <ul className="mt-3.5 space-y-2">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-baseline gap-2.5">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[segment.tone])} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                {/* Text wears text tokens. The dot beside it carries identity —
                    a mint-coloured label would be unreadable on the surface. */}
                <p className="text-xs font-medium text-bone">{segment.label}</p>
                <p className="shrink-0 text-xs font-semibold text-bone tabular">
                  {formatINR(segment.paise)}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-faint">{segment.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Sparkline — the trend inside a stat tile
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Twelve points of shape, no axes and no labels.
 *
 * Deliberately unreadable as values: it answers "which way is this going"
 * and nothing else. The number above it is the value.
 */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 64;
  const height = 18;
  const max = Math.max(...values, 1);

  if (values.length < 2) return null;

  const path = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - (value / max) * (height - 2) - 1;
    // Full precision. SVG takes it happily, and trimming coordinates would
    // mean reaching for `toFixed` in a file that also renders money.
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  });

  return (
    <svg
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={path.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════ */

/** "09 Sep" from a campus-local "YYYY-MM-DD", without constructing a Date. */
function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${day ?? ""} ${names[Number(month) - 1] ?? ""}`.trim();
}

/**
 * Round the axis top to something a person would have chosen: 1, 2 or 5 times
 * a power of ten. An axis topping out at ₹4,732 is an axis nobody can read a
 * midpoint off.
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
