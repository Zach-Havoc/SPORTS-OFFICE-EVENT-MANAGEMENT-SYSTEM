import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../ui/utils";

export interface AttentionItem {
  /** The figure that makes this worth looking at. */
  count: number;
  label: string;
  /** What to do about it, in the user's own language. */
  detail: string;
  to: string;
  icon: LucideIcon;
  tone?: "live" | "action" | "info";
}

const TONE: Record<NonNullable<AttentionItem["tone"]>, string> = {
  live: "text-brand",
  action: "text-warning",
  info: "text-text-secondary",
};

/**
 * A dashboard's first job is to answer "does anything need me?". The grid
 * below this band answers "how are things going", which is a different and
 * less urgent question, and it used to be the only question the page asked:
 * eighteen equally weighted tiles, with the live-game count sharing its
 * visual weight with the venue count.
 *
 * Items only appear when they have something to report, so a quiet day shows
 * a quiet band rather than a row of zeroes.
 */
export function AttentionBand({ items }: { items: AttentionItem[] }) {
  const live = items.filter((i) => i.count > 0);

  if (live.length === 0) {
    return (
      <div className="mb-8 flex items-center gap-2.5 border-y border-border py-4">
        <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="text-sm text-text-secondary">
          Nothing needs attention right now. No live games, and every upcoming
          event has its committee assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 border-y border-border">
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3">
        {live.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.label}
              className="border-border-subtle sm:not-first:border-l sm:[&:nth-child(3n+1)]:border-l-0"
            >
              <Link
                to={item.to}
                className={cn(
                  "group flex h-full items-start gap-3 px-4 py-4 transition-colors duration-[140ms]",
                  "hover:bg-surface-hover",
                  "sm:px-5",
                )}
              >
                <Icon
                  className={cn("mt-0.5 size-4 shrink-0", TONE[item.tone ?? "info"])}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="numeral text-lg leading-none text-text">
                      {item.count}
                    </span>
                    <span className="text-sm font-medium text-text">{item.label}</span>
                  </span>
                  <span className="t-caption mt-1 block">{item.detail}</span>
                </span>
                <ArrowRight
                  className="mt-1 size-3.5 shrink-0 text-text-muted opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
