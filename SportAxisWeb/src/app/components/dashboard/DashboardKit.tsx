import { ReactNode } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUp, ArrowDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "../ui/utils";

// Klipfolio-style dense metric tiles: a light-grey canvas, white bordered
// tiles in a 12-column mosaic, big-number heroes with a period-over-period
// delta chip and a thin sparkline underneath.

export const BLUE = "#3b82f6";
export const CHART_COLORS = [
  "#3b82f6",
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];
export const STATUS_COLORS = {
  upcoming: "#f59e0b",
  ongoing: "#22c55e",
  completed: "#94a3b8",
};
// These two map 1:1 onto the app's semantic tokens (theme.css --success/
// --warning/--info/--destructive) — same literal hex, so a chart's "approved"
// green is the exact same green as a Badge's success variant elsewhere,
// instead of each picking its own slightly-different shade.
export const ATTENDANCE_COLORS = {
  present: "#059669",
  late: "#D97706",
  excused: "#2563EB",
  absent: "#DC2626",
};
export const REQUIREMENT_COLORS = {
  approved: "#059669",
  pending: "#D97706",
  rejected: "#DC2626",
};
export const MEDAL_COLORS = {
  gold: "#f59e0b",
  silver: "#94a3b8",
  bronze: "#b45309",
};

const TT = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
    fontSize: 12,
    padding: "6px 10px",
  },
  labelStyle: { fontWeight: 600, color: "#0f172a" },
};

// ── Canvas + grid ─────────────────────────────────────────────────────────
export function DashboardCanvas({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-12">
      {children}
    </div>
  );
}

type Span = 3 | 4 | 5 | 6 | 8 | 9 | 12;
const SPAN: Record<Span, string> = {
  3: "md:col-span-1 xl:col-span-3",
  4: "md:col-span-1 xl:col-span-4",
  5: "md:col-span-1 xl:col-span-5",
  6: "md:col-span-2 xl:col-span-6",
  8: "md:col-span-2 xl:col-span-8",
  9: "md:col-span-2 xl:col-span-9",
  12: "md:col-span-2 xl:col-span-12",
};

export function Tile({
  title,
  subtitle,
  right,
  span = 6,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  span?: Span;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white shadow-xs transition-shadow hover:shadow-sm",
        SPAN[span],
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-[13px] font-semibold tracking-wide text-slate-700 uppercase">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </div>
  );
}

export function Empty({
  h = 120,
  msg = "No data yet",
}: {
  h?: number;
  msg?: string;
}) {
  return (
    <div
      className="flex items-center justify-center text-xs text-slate-400"
      style={{ height: h }}
    >
      {msg}
    </div>
  );
}

// ── Delta chip ────────────────────────────────────────────────────────────
export function Delta({
  pct,
  className,
}: {
  pct: number | null | undefined;
  className?: string;
}) {
  if (pct == null || !isFinite(pct)) return null;
  const rounded = Math.round(pct);
  const flat = rounded === 0;
  const up = pct > 0;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        flat ? "text-slate-400" : up ? "text-success" : "text-destructive",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(rounded)}%
    </span>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────
export function Sparkline({
  data,
  height = 40,
  color = BLUE,
  type = "area",
}: {
  data: number[];
  height?: number;
  color?: string;
  type?: "area" | "line";
}) {
  const d = (data.length ? data : [0, 0]).map((v, i) => ({ i, v }));
  const gid = "sl" + color.replace(/[^a-z0-9]/gi, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "area" ? (
        <AreaChart data={d} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gid})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      ) : (
        <LineChart data={d} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

// ── Big-number metric (hero) ──────────────────────────────────────────────
export function Metric({
  label,
  value,
  pct,
  prev,
  spark,
  sparkType = "area",
  color = BLUE,
}: {
  label: string;
  value: ReactNode;
  pct?: number | null;
  prev?: ReactNode;
  spark?: number[];
  sparkType?: "area" | "line";
  color?: string;
}) {
  return (
    <div className="flex-1 px-3 py-1 text-center">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-slate-800 sm:text-[2.5rem] sm:leading-tight">
        {value}
      </p>
      {(pct != null || prev != null) && (
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 text-[11px] text-slate-400">
          <Delta pct={pct} />
          {prev != null && <span>vs. {prev} (prev.)</span>}
        </p>
      )}
      {spark && (
        <div className="mt-2">
          <Sparkline data={spark} color={color} type={sparkType} height={44} />
        </div>
      )}
    </div>
  );
}

export function HeroTile({
  title,
  subtitle,
  right,
  span = 6,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  span?: Span;
  children: ReactNode;
}) {
  return (
    <Tile title={title} subtitle={subtitle} right={right} span={span}>
      <div className="flex divide-x divide-slate-100">{children}</div>
    </Tile>
  );
}

// ── Small stat helpers ────────────────────────────────────────────────────
export function IconStat({
  icon: Icon,
  iconClass,
  value,
  caption,
}: {
  icon: LucideIcon;
  iconClass?: string;
  value: ReactNode;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 text-center">
      <Icon className={cn("h-6 w-6", iconClass ?? "text-slate-400")} />
      <span className="text-2xl font-bold tabular-nums text-slate-800">{value}</span>
      <span className="text-[11px] text-slate-400">{caption}</span>
    </div>
  );
}

export function BareStat({
  value,
  label,
  pct,
  prev,
}: {
  value: ReactNode;
  label: string;
  pct?: number | null;
  prev?: ReactNode;
}) {
  return (
    <div className="py-1">
      <div className="flex items-baseline gap-2">
        <span className="text-[2rem] font-bold leading-none tracking-tight tabular-nums text-slate-800">
          {value}
        </span>
        <Delta pct={pct} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {label}
        {prev != null && ` · vs ${prev} prev.`}
      </p>
    </div>
  );
}

// ── Metric table with inline sparklines (LinkedIn Key Metrics style) ──────
export interface MetricRow {
  metric: string;
  current: number;
  prev: number;
  trend: number[];
}

export function MetricTable({ rows }: { rows: MetricRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-slate-400">
            <th className="pb-2 text-left font-medium">Metric</th>
            <th className="pb-2 text-right font-medium">Last 30d</th>
            <th className="pb-2 text-right font-medium">Prev 30d</th>
            <th className="pb-2 pl-4 text-left font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.prev
              ? ((r.current - r.prev) / r.prev) * 100
              : r.current
                ? 100
                : 0;
            return (
              <tr key={r.metric} className="border-t border-slate-100">
                <td className="py-2 pr-2 text-slate-600">{r.metric}</td>
                <td className="py-2 text-right font-semibold tabular-nums text-slate-800">
                  {r.current.toLocaleString()}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-400">
                  {r.prev.toLocaleString()}
                </td>
                <td className="py-1 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-24 shrink-0">
                      <Sparkline data={r.trend} type="line" height={32} />
                    </div>
                    <Delta pct={pct} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Distribution bar (single stacked bar + legend) ───────────────────────
export function DistBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <Empty />;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map(
          (s) =>
            s.value > 0 && (
              <div
                key={s.label}
                style={{
                  width: `${(s.value / total) * 100}%`,
                  background: s.color,
                }}
              />
            ),
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        {segments.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-1.5 text-slate-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums text-slate-700">
              {s.value.toLocaleString()}
              <span className="ml-1 text-slate-400">
                {Math.round((s.value / total) * 100)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ranked horizontal mini-bars ─────────────────────────────────────────
export function RankList({
  items,
  color = BLUE,
  unit,
}: {
  items: { label: string; value: number }[];
  color?: string;
  unit?: string;
}) {
  if (!items.length || items.every((i) => !i.value)) return <Empty />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-slate-600">{i.label}</span>
            <span className="ml-2 shrink-0 font-semibold tabular-nums text-slate-700">
              {i.value.toLocaleString()}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(i.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StackedRankBars({
  data,
  keys,
  height = 260,
}: {
  data: Record<string, string | number>[];
  keys: { key: string; name: string; color: string }[];
  height?: number;
}) {
  if (!data.length) return <Empty h={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip {...TT} cursor={{ fill: "#f8fafc" }} />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.name}
            stackId="a"
            fill={k.color}
            radius={i === keys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Range picker ─────────────────────────────────────────────────────────
export function RangePicker({
  value,
  onChange,
  options = [7, 14, 30],
}: {
  value: number;
  onChange: (v: number) => void;
  options?: number[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 shadow-xs outline-none transition-colors focus:border-slate-400"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o} Days
        </option>
      ))}
    </select>
  );
}

// ── Data helpers ─────────────────────────────────────────────────────────
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Daily occurrence counts over the last `days` days (oldest → newest). */
export function dailyCounts(
  rows: any[],
  field: string,
  days: number,
): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(dayKey(d), 0);
  }
  for (const r of rows ?? []) {
    const raw = r?.[field];
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(+d)) continue;
    d.setHours(0, 0, 0, 0);
    const k = dayKey(d);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return [...buckets.values()];
}

/** `{ current, prev, pct }` — last `days` window vs the `days` before it. */
export function periodDelta(rows: any[], field: string, days: number) {
  const now = Date.now();
  const win = days * 86_400_000;
  let current = 0;
  let prev = 0;
  for (const r of rows ?? []) {
    const raw = r?.[field];
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (isNaN(t)) continue;
    const age = now - t;
    if (age >= 0 && age < win) current++;
    else if (age >= win && age < win * 2) prev++;
  }
  const pct = prev ? ((current - prev) / prev) * 100 : current ? 100 : 0;
  return { current, prev, pct };
}

/** A "Last 30d / Prev 30d / trend" row for MetricTable. */
export function metricRow(
  label: string,
  rows: any[],
  field: string,
): MetricRow {
  const { current, prev } = periodDelta(rows, field, 30);
  return { metric: label, current, prev, trend: dailyCounts(rows, field, 30) };
}

/** Count occurrences of each label, top `limit`. */
export function tally(
  values: (string | null | undefined)[],
  limit = 8,
  fallback = "Unassigned",
) {
  const m = new Map<string, number>();
  for (const raw of values ?? []) {
    const key = (raw ?? "").toString().trim() || fallback;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function fmtInt(n: number) {
  return n.toLocaleString();
}
