import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "../ui/utils";

/*
 * Console building blocks: the operations-board vocabulary shared by the role
 * dashboards. Paper canvas, white panels on a 1px hairline with a low lit
 * shadow, Archivo figures on the wide axis. Crimson is reserved for live
 * state and primary action; teal (the `aqua` tokens) marks what is scheduled.
 */

/** Page frame: one gutter and max width for every console dashboard. */
export function ConsolePage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 pt-6 pb-10 sm:px-6 lg:px-8">{children}</div>
  );
}

/** A titled panel. `action` sits at the right of the title row. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  headingLevel: H = "h2",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-1)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <H className="text-[0.9375rem] font-semibold leading-snug tracking-[-0.004em] text-text [word-spacing:0.06em]">{title}</H>
          {description && <p className="t-caption mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn("min-w-0 flex-1 px-5 pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** "View all →" style link for a panel's title row. */
export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-1 rounded-sm text-[0.8125rem] font-medium text-text-secondary",
        "transition-colors duration-[140ms] hover:text-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
      )}
    >
      {children}
      <ArrowRight
        className="size-3.5 transition-transform duration-[140ms] group-hover:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
  );
}

export type StatTone = "neutral" | "live" | "scheduled" | "attention";

const TONE_ICON: Record<StatTone, string> = {
  neutral: "bg-bg-subtle text-text-secondary",
  live: "bg-brand-subtle text-brand-text",
  scheduled: "bg-aqua-subtle text-aqua-text",
  attention: "bg-warning-subtle text-warning-foreground",
};

/**
 * One headline figure. Links to where the figure is acted on. `delta` is shown
 * only when the figure has real history behind it (timestamped rows).
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
  to,
  delta,
  live,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: StatTone;
  to?: string;
  delta?: { value: number; label: string } | null;
  /** Adds the live pip beside the label (something is happening right now). */
  live?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="t-label flex items-center gap-2">
          {live && (
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
          )}
          {label}
        </p>
        <span
          className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", TONE_ICON[tone])}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="numeral text-[2rem] leading-none text-text">{value}</span>
        {delta && delta.value !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
              delta.value > 0 ? "bg-success-subtle text-success-foreground" : "bg-danger-subtle text-danger-text",
            )}
            title={delta.label}
          >
            {delta.value > 0 ? (
              <ArrowUpRight className="size-3" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="size-3" aria-hidden="true" />
            )}
            {delta.value > 0 ? "+" : ""}
            {delta.value}
            <span className="sr-only"> {delta.label}</span>
          </span>
        )}
      </div>
      {detail && <p className="t-caption mt-2 line-clamp-2">{detail}</p>}
    </>
  );

  const frame = cn(
    "block min-w-0 rounded-[var(--radius-lg)] border border-border bg-surface px-4 pt-3.5 pb-4 shadow-[var(--shadow-1)]",
  );

  if (!to) return <div className={frame}>{body}</div>;
  return (
    <Link
      to={to}
      className={cn(
        frame,
        "transition-[border-color,box-shadow] duration-[140ms] hover:border-border-strong hover:shadow-[var(--shadow-2)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
      )}
    >
      {body}
    </Link>
  );
}

/** Event status as the office speaks about it: live, scheduled, final. */
export function EventStatusBadge({ status }: { status?: string | null }) {
  const s = status ?? "upcoming";
  if (s === "ongoing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand-subtle px-1.5 py-0.5 text-[0.6875rem] font-semibold text-brand-text">
        <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
        Live
      </span>
    );
  }
  if (s === "completed") {
    return (
      <span className="inline-flex items-center rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[0.6875rem] font-semibold text-text-secondary">
        Final
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-sm bg-aqua-subtle px-1.5 py-0.5 text-[0.6875rem] font-semibold text-aqua-text">
      Scheduled
    </span>
  );
}

/** An empty panel body that says what would appear and how to get it there. */
export function PanelEmpty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
      <Icon className="size-5 text-text-muted" aria-hidden="true" />
      <p className="text-[0.8125rem] font-medium text-text">{title}</p>
      {children && <p className="t-caption max-w-xs">{children}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** "3m ago" for recent rows; absolute date past a week. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
