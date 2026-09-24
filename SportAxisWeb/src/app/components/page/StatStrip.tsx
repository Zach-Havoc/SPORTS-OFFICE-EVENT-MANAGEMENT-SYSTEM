import { cn } from "../ui/utils";

export interface Stat {
  label: string;
  value: number | string;
  /** Set only where the value's state is the point (outstanding, overdue). */
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
}

const TONE: Record<NonNullable<Stat["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
};

/**
 * Replaces the boxed stat rows on list pages. Those were the hero-metric
 * template repeated four to six times: same-size cards, big number, small
 * label, and on several pages a Card nested inside another Card to hold
 * them. Six equally-weighted boxes claimed the whole first viewport on a
 * phone and pushed the page's actual working surface below the fold.
 *
 * This is one line of figures separated by rules rather than by containers,
 * so the counts stay readable but stop competing with the task underneath.
 */
export function StatStrip({
  stats,
  className,
}: {
  stats: Stat[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "mb-8 flex flex-wrap items-stretch gap-x-8 gap-y-4 border-y border-border py-4",
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-[4.5rem]">
          <dd className={cn("numeral text-xl leading-none", TONE[stat.tone ?? "default"])}>
            {stat.value}
          </dd>
          <dt className="t-label mt-1.5">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
