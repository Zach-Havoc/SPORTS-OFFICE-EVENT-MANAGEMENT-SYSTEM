import type { ReactNode } from "react";

import { cn } from "../ui/utils";

/**
 * The one page-header role. Before this, every page invented its own: six
 * competing size/weight combinations, sixteen of them hardcoding
 * text-gray-900 instead of a token, and three coloring the h1 green or red,
 * which asks color to carry hierarchy that weight should carry.
 *
 * There is deliberately no eyebrow slot. A small label above a heading adds
 * a second thing to read before the first one, and the heading already
 * carries its own weight.
 *
 * `actions` sits on the same optical line as the title on wide viewports and
 * wraps beneath it on narrow ones, so a long title and a two-button action
 * group cannot push each other off-screen.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-[22rem]">
          <h1 className="t-page-title">{title}</h1>
          {description ? <p className="t-page-lede mt-1.5">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
