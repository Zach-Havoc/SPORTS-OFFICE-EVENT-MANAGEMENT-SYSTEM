import { Skeleton } from "./ui/skeleton";

/**
 * A grid of card-shaped placeholders, sized to roughly match a real
 * event/athlete card (header line + a few detail rows + action buttons).
 * Used while a list query is loading, in place of a generic spinner.
 */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-2 pb-3 border-b border-gray-100 mb-3">
            <Skeleton className="h-4 w-4 rounded-sm shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/5" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A set of table-row placeholders, sized to match a real data-table row
 * (avatar/name cell, a couple of mid columns, a status pill, action icons).
 * Used while a table-backed list query is loading.
 */
export function TableRowsSkeleton({
  rows = 6,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-gray-100 py-3 px-4"
        >
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {Array.from({ length: Math.max(columns - 2, 0) }).map((_, c) => (
            <Skeleton key={c} className="hidden md:block h-3 w-16" />
          ))}
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A set of card placeholders for list screens that use a stacked-card
 * layout instead of a table (e.g. Users, Protests). */
export function StackedCardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
