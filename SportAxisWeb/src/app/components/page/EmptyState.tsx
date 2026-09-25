import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../ui/utils";

/**
 * An empty state teaches the interface. "No data" tells the user nothing they
 * did not already know, so every one of these names what will fill the space
 * and offers the action that fills it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-10" : "px-6 py-16",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-surface-sunken text-text-muted">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <p className="t-subsection">{title}</p>
      {description ? (
        <p className="t-supporting mx-auto mt-1.5 max-w-[44ch]">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
