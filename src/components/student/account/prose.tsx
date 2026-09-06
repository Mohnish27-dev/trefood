import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

/**
 * The reading surfaces: policy prose and the help accordion.
 *
 * The accordion is a native `<details>`, deliberately. These pages are read by
 * someone whose order has already gone wrong, sometimes on a bad connection
 * before the JavaScript bundle has landed — and a `<details>` opens anyway.
 * There is no state, no hook and no client boundary in this file.
 */

export function Prose({ children }: { children: ReactNode }) {
  return <div className="space-y-5 text-sm leading-relaxed text-muted">{children}</div>;
}

export function ProseSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-base font-semibold text-bone">{heading}</h2>
      {children}
    </section>
  );
}

export function ProseList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item, index) => (
        <li key={index} className="list-disc marker:text-saffron/60">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LastUpdated({ date }: { date: string }) {
  return (
    <p className="px-1 text-[11px] uppercase tracking-[0.12em] text-faint">
      Last updated {date}
    </p>
  );
}

export function FaqGroup({ children }: { children: ReactNode }) {
  return <Card className="divide-y divide-line">{children}</Card>;
}

export function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-sm font-medium text-bone">{question}</span>
        <ChevronDown className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </details>
  );
}
