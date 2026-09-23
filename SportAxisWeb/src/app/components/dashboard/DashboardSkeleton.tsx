import { Skeleton } from "../ui/skeleton";

/**
 * Shown while a dashboard's queries are loading. Deliberately does NOT
 * import anything from `DashboardKit` (that module is lazy-loaded via
 * route.lazy specifically to keep recharts out of the initial bundle) —
 * pulling it in here just to render a placeholder would defeat that split.
 * Instead this mimics the dense tile grid with plain Tailwind classes.
 */
const SPAN: Record<number, string> = {
  3: "md:col-span-1 xl:col-span-3",
  4: "md:col-span-1 xl:col-span-4",
  6: "md:col-span-2 xl:col-span-6",
  8: "md:col-span-2 xl:col-span-8",
  12: "md:col-span-2 xl:col-span-12",
};

function TileSkeleton({ span = 6, rows = 3 }: { span?: number; rows?: number }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${SPAN[span]}`}
    >
      <div className="border-b border-slate-100 px-4 py-2.5">
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="space-y-2.5 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-12">
          <TileSkeleton span={3} rows={4} />
          <TileSkeleton span={6} rows={5} />
          <TileSkeleton span={3} rows={4} />
          <TileSkeleton span={4} rows={5} />
          <TileSkeleton span={4} rows={5} />
          <TileSkeleton span={4} rows={5} />
          <TileSkeleton span={6} rows={6} />
          <TileSkeleton span={6} rows={6} />
        </div>
      </div>
    </div>
  );
}
