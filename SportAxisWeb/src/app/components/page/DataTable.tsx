import type { ReactNode } from "react";

import { cn } from "../ui/utils";

/**
 * Table primitives tuned for scanning rather than for decoration.
 *
 * - the header is a quiet overline, not a heavy band
 * - rows are separated by a hairline, never boxed
 * - numeric columns are tabular and right-aligned so digits stack
 * - row actions stay mounted for keyboard and touch, and lift in visibility
 *   on hover, so a 40-row table is not 120 competing buttons
 */
export function TableFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)}>
      {children}
    </table>
  );
}

export function Th({
  children,
  align = "left",
  className,
  ...props
}: React.ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "t-overline border-b border-border bg-surface-sunken/60 px-4 py-2.5 font-semibold",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  selected = false,
  className,
  ...props
}: React.ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cn(
        "group border-b border-border-subtle transition-colors duration-[140ms] last:border-0",
        "hover:bg-surface-hover",
        "data-[selected]:bg-brand-subtle data-[selected]:hover:bg-brand-subtle-hover",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  numeric = false,
  className,
  ...props
}: React.ComponentProps<"td"> & {
  align?: "left" | "right" | "center";
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-text",
        numeric && "tabular-nums",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** Row actions: present for keyboard and touch, quieter until the row is hovered. */
export function RowActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1",
        "opacity-70 transition-opacity duration-[140ms]",
        "group-hover:opacity-100 group-focus-within:opacity-100",
        "motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
