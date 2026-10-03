import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  FileBadge,
  Flag,
  Gavel,
  Inbox,
  Radio,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import {
  useCurrentSeason,
  useDepartments,
  useEvents,
  useLeaderboard,
  useTransactions,
  useUsers,
} from "../../hooks/api";
import type { OfficeTransaction } from "../../services/api";
import { useDeptAbbreviator, shortDeptLabel } from "../../utils/departments";
import { RefreshStatus } from "../../components/RefreshStatus";
import { Skeleton } from "../../components/ui/skeleton";
import {
  ConsolePage,
  Panel,
  PanelEmpty,
  PanelLink,
  StatCard,
  timeAgo,
} from "../../components/dashboard/ConsoleKit";
import { periodDelta } from "../../components/dashboard/DashboardKit";
import { cn } from "../../components/ui/utils";

/* Played vs scheduled. Brand crimson for what has happened, the teal accent
   for what is still ahead: validated as a pair for colour-vision separation. */
const PLAYED = "#D02525";
const SCHEDULED = "#0092A0";
/* Past games never closed. Amber, validated as the middle of the three. */
const NOT_CLOSED = "#C98A1C";
/* Athletes by gender. Steel and pine: clear of the red / teal / amber that
   mean played / scheduled / no result above, and apart in hue for
   colour-vision deficiency (blue against green, not blue against purple). */
/* One colour per college on the donut: the shared chart palette, plus slate. */
const COLLEGE_COLORS = [
  "#436590",
  "#0092A0",
  "#CB8B2E",
  "#834765",
  "#497F5D",
  "#D02525",
  "#6B7A8C",
];

const DAY = 86_400_000;

type Abbr = (t: string | null | undefined) => string;

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of an event's `YYYY-MM-DD` schedule (no timezone shift). */
function eventDate(schedule: string | null | undefined): Date | null {
  if (!schedule) return null;
  const [y, m, d] = String(schedule).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Monday of the week containing `d`. */
function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function fmtTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardEnhanced() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/login");
  }, [user, navigate]);

  const abbreviate = useDeptAbbreviator();
  const eventsQuery = useEvents();
  const departmentsQuery = useDepartments();
  const leaderboardQuery = useLeaderboard();
  const usersQuery = useUsers({});
  const seasonQuery = useCurrentSeason();
  const openQuery = useTransactions({ status: "open", perPage: 100 });

  const queries = [
    eventsQuery,
    departmentsQuery,
    leaderboardQuery,
    usersQuery,
  ];

  const events: any[] = eventsQuery.data ?? [];
  const departments: any[] = departmentsQuery.data ?? [];
  const leaderboard: any[] = leaderboardQuery.data ?? [];
  const users: any[] = usersQuery.data ?? [];
  const openItems: OfficeTransaction[] = openQuery.data?.data ?? [];
  const openTotal = openQuery.data?.counts.open ?? 0;

  const loading = queries.some((q) => q.isLoading);
  const fetching = queries.some((q) => q.isFetching) && !loading;
  const backgroundError = queries.some((q) => q.isRefetchError);
  const retryAll = () => queries.forEach((q) => q.refetch());

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = isoDay(today);

  const athleteUsers = useMemo(
    () => users.filter((u) => u.role === "athlete"),
    [users],
  );
  const coachUsers = useMemo(
    () => users.filter((u) => u.role === "coach"),
    [users],
  );
  const committeeUsers = useMemo(
    () => users.filter((u) => u.role === "judge"),
    [users],
  );

  const deptByName = useMemo(() => {
    const m = new Map<string, any>();
    departments.forEach((d) => m.set(d.name, d));
    return m;
  }, [departments]);

  /* ── Figures ─────────────────────────────────────────────────────────── */
  // Live means in progress today. A game dated earlier and still "ongoing" was
  // never closed; it belongs in the not-closed queue, not the live count.
  const liveNow = events.filter(
    (e) =>
      e.status === "ongoing" && String(e.schedule).slice(0, 10) === todayIso,
  ).length;

  const ahead = useMemo(
    () =>
      events
        .filter((e) => {
          const d = eventDate(e.schedule);
          return d && d >= today && (e.status ?? "upcoming") !== "completed";
        })
        .sort(
          (a, b) =>
            String(a.schedule).localeCompare(String(b.schedule)) ||
            String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, todayIso],
  );
  const weekEnd = new Date(today.getTime() + 7 * DAY);
  const nextSeven = ahead.filter((e) => {
    const d = eventDate(e.schedule);
    return d !== null && d.getTime() < weekEnd.getTime();
  });
  const nextEvent = ahead[0];

  const athletesNew = useMemo(
    () => periodDelta(athleteUsers, "createdAt", 30),
    [athleteUsers],
  );

  const serverByType = openQuery.data?.counts.byType;
  const openByType = useMemo(() => {
    if (serverByType) {
      // The API client camel-cases keys (cmo_requirement → cmoRequirement).
      const by = serverByType as Record<string, number>;
      const pick = (k: string) =>
        by[k] ?? by[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] ?? 0;
      return {
        cmo_requirement: pick("cmo_requirement"),
        protest: pick("protest"),
      };
    }
    const c = {
      cmo_requirement: 0,
      protest: 0,
    } as Record<string, number>;
    openItems.forEach((t) => (c[t.type] = (c[t.type] ?? 0) + 1));
    return c;
  }, [openItems, serverByType]);

  const unstaffed = ahead.filter((e) => (e.judges || []).length === 0);
  // Past games that never reached "completed": the result was never closed,
  // so they never reach the standings. The office should see them.
  const unclosed = events.filter((e) => {
    const d = eventDate(e.schedule);
    return (
      d !== null && d.getTime() < today.getTime() && e.status !== "completed"
    );
  }).length;

  /* ── Status sentence: the five-second read ───────────────────────────── */
  const sentence: string[] = [];
  if (liveNow)
    sentence.push(`${liveNow} ${liveNow === 1 ? "game is" : "games are"} live`);
  sentence.push(
    nextSeven.length
      ? `${nextSeven.length} ${nextSeven.length === 1 ? "event" : "events"} in the next 7 days`
      : "nothing scheduled in the next 7 days",
  );
  if (openTotal)
    sentence.push(
      `${openTotal} ${openTotal === 1 ? "request needs" : "requests need"} a decision`,
    );
  if (unstaffed.length)
    sentence.push(
      `${unstaffed.length} upcoming ${unstaffed.length === 1 ? "event has" : "events have"} no committee`,
    );

  if (loading) return <DashboardLoading />;

  const firstName = (user?.name ?? "").split(" ")[0];
  const season = seasonQuery.data;

  return (
    <ConsolePage>
      {/* ── Greeting and state of play ─────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="t-page-title">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="t-supporting mt-1">
            <span className="text-text">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            {season && (
              <>
                <span className="mx-1.5 text-text-muted" aria-hidden="true">
                  ·
                </span>
                {season.name}
              </>
            )}
            <span className="mx-1.5 text-text-muted" aria-hidden="true">
              ·
            </span>
            {sentence.join(", ")}.
          </p>
        </div>
        <RefreshStatus
          fetching={fetching}
          error={backgroundError}
          onRetry={retryAll}
        />
      </div>

      {/* ── Headline figures ──────────────────────────────────────────── */}
      <div
        className={cn(
          "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4",
          "[&>*]:w-[16.5rem] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto",
        )}
      >
        <StatCard
          icon={Radio}
          label="Live today"
          value={liveNow}
          live={liveNow > 0}
          tone={liveNow > 0 ? "live" : "neutral"}
          to="/live"
          detail={
            liveNow
              ? "Games in progress · open the live board"
              : "No games in progress"
          }
        />
        <StatCard
          icon={CalendarDays}
          label="Coming up · 7 days"
          value={nextSeven.length}
          tone="scheduled"
          to="/admin/events"
          detail={
            nextEvent
              ? `Next: ${
                  (nextEvent.departments ?? []).length === 2
                    ? `${shortDeptLabel(abbreviate, nextEvent.departments[0], 12)} vs ${shortDeptLabel(abbreviate, nextEvent.departments[1], 12)}`
                    : abbreviate(nextEvent.name)
                } · ${
                  nextEvent.schedule === todayIso
                    ? "today"
                    : (
                        eventDate(nextEvent.schedule) as Date
                      ).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                }${nextEvent.startTime ? `, ${fmtTime(nextEvent.startTime)}` : ""}`
              : "Nothing on the calendar"
          }
        />
        <StatCard
          icon={Inbox}
          label="Pending requests"
          value={openTotal}
          tone={openTotal ? "attention" : "neutral"}
          to="/admin/transactions"
          detail={
            openTotal
              ? [
                  openByType.cmo_requirement &&
                    `${openByType.cmo_requirement} CMO ${openByType.cmo_requirement === 1 ? "requirement" : "requirements"}`,
                  openByType.protest && `${openByType.protest} ${openByType.protest === 1 ? "appeal" : "appeals"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "No requests to decide"
          }
        />
        <StatCard
          icon={Users}
          label="Registered athletes"
          value={athleteUsers.length.toLocaleString()}
          to="/admin/users"
          delta={
            athletesNew.current || athletesNew.prev
              ? {
                  value: athletesNew.current,
                  label: `new athlete accounts in the last 30 days (previous 30 days: ${athletesNew.prev})`,
                }
              : null
          }
          detail={`${coachUsers.length} ${coachUsers.length === 1 ? "coach" : "coaches"} · ${committeeUsers.length} committee ${committeeUsers.length === 1 ? "member" : "members"}`}
        />
      </div>

      {/* Five panels. The two charts lead, right under the headline figures:
          the season's rhythm and who is registered. Then the game day board,
          beside what needs a decision and the standings. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SeasonActivity
          events={events}
          today={today}
          className="lg:col-span-8"
        />
        <AthletesByCollege
          athletes={athleteUsers}
          departments={departments}
          abbreviate={abbreviate}
          className="lg:col-span-4"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <GameDay
          events={events}
          today={today}
          now={now}
          abbreviate={abbreviate}
          className="lg:col-span-8"
        />
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-4">
          <NeedsAttention
            items={openItems.slice(0, 4)}
            total={openTotal}
            unstaffed={unstaffed.length}
            unclosed={unclosed}
          />
          <Standings
            rows={leaderboard}
            abbreviate={abbreviate}
            deptByName={deptByName}
          />
        </div>
      </div>
    </ConsolePage>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Season activity: events per week, played vs scheduled, this week marked.
   ═══════════════════════════════════════════════════════════════════════ */

function SeasonActivity({
  events,
  today,
  className,
}: {
  events: any[];
  today: Date;
  className?: string;
}) {
  const { data, thisWeekLabel, played, notClosed, scheduled } =
    useMemo(() => {
      const thisWeek = weekStart(today).getTime();
      const dated = events
        .map((e) => ({ e, d: eventDate(e.schedule) }))
        .filter((x): x is { e: any; d: Date } => !!x.d);
      const weeks = dated.map((x) => weekStart(x.d).getTime());
      // Window: the season's own weeks around today, at most twelve columns,
      // always showing this week, three behind it and two ahead of it.
      let start = Math.min(thisWeek - 3 * 7 * DAY, ...weeks);
      let end = Math.max(thisWeek + 2 * 7 * DAY, ...weeks);
      if ((end - start) / (7 * DAY) + 1 > 12) {
        start = Math.max(start, thisWeek - 9 * 7 * DAY);
        end = start + 11 * 7 * DAY;
      }
      const buckets: {
        key: number;
        label: string;
        range: string;
        played: number;
        notClosed: number;
        scheduled: number;
      }[] = [];
      for (let t = start; t <= end; t += 7 * DAY) {
        const s = new Date(t);
        const e = new Date(t + 6 * DAY);
        buckets.push({
          key: t,
          label: s.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          range: `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
          played: 0,
          notClosed: 0,
          scheduled: 0,
        });
      }
      const byKey = new Map(buckets.map((b) => [b.key, b]));
      for (const { e, d } of dated) {
        const b = byKey.get(weekStart(d).getTime());
        if (!b) continue;
        // A game dated before today that is not final was never closed; it is
        // neither played nor still to play, so it gets its own series.
        if (e.status === "completed") b.played++;
        else if (d.getTime() < today.getTime()) b.notClosed++;
        else b.scheduled++;
      }
      const totals = dated.reduce(
        (t, { e, d }) => {
          if (e.status === "completed") t.played++;
          else if (d.getTime() < today.getTime()) t.notClosed++;
          else t.scheduled++;
          return t;
        },
        { played: 0, notClosed: 0, scheduled: 0 },
      );
      return {
        data: buckets,
        thisWeekLabel: byKey.get(thisWeek)?.label,
        ...totals,
      };
    }, [events, today]);

  const hasAny = data.some((b) => b.played + b.notClosed + b.scheduled > 0);
  const series = [
    { key: "played" as const, label: "Played", color: PLAYED, show: true },
    {
      key: "notClosed" as const,
      label: "No result",
      color: NOT_CLOSED,
      show: notClosed > 0,
    },
    {
      key: "scheduled" as const,
      label: "Scheduled",
      color: SCHEDULED,
      show: true,
    },
  ].filter((x) => x.show);

  return (
    <Panel
      className={className}
      title="Season activity"
      description={
        hasAny
          ? `${played} played · ${scheduled} to play${notClosed ? ` · ${notClosed} past without a result` : ""}`
          : "Events per week"
      }
    >
      {hasAny ? (
        <>
          <div
            className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary"
            aria-hidden="true"
          >
            {series.map((x) => (
              <span key={x.key} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[3px]"
                  style={{ background: x.color }}
                />
                {x.label}
              </span>
            ))}
          </div>
          <div
            className="chart-reveal h-60 w-full lg:h-[22rem]"
            role="img"
            aria-label="Events per week: played, no result and scheduled"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 18, right: 8, bottom: 0, left: -8 }}
              >
                <defs>
                  {series.map((x) => (
                    <linearGradient
                      key={x.key}
                      id={`season-${x.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={x.color} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={x.color} stopOpacity={0.12} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                {thisWeekLabel && (
                  <ReferenceLine
                    x={thisWeekLabel}
                    stroke="var(--text-muted)"
                    strokeDasharray="3 3"
                    label={{
                      value: "This week",
                      position: "top",
                      fill: "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                )}
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  width={44}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border-strong)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const b = payload[0].payload as (typeof data)[number];
                    return (
                      <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-3)]">
                        <p className="mb-1 font-semibold text-text">
                          {b.range}
                        </p>
                        {series.map((x) => (
                          <p
                            key={x.key}
                            className="flex items-center gap-2 text-text-secondary"
                          >
                            <span
                              className="size-2 rounded-[2px]"
                              style={{ background: x.color }}
                            />
                            {x.label}
                            <span className="ml-auto pl-4 font-semibold tabular-nums text-text">
                              {b[x.key]}
                            </span>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                {series.map((x) => (
                  <Area
                    key={x.key}
                    type="monotone"
                    dataKey={x.key}
                    stackId="w"
                    stroke={x.color}
                    strokeWidth={2}
                    fill={`url(#season-${x.key})`}
                    isAnimationActive={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* The wrapper carries sr-only: a table ignores the 1px width trick and widens the page. */}
          <div className="sr-only">
            <table>
              <caption>Events per week</caption>
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col">Played</th>
                  <th scope="col">No result</th>
                  <th scope="col">Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.key}>
                    <th scope="row">{b.range}</th>
                    <td>{b.played}</td>
                    <td>{b.notClosed}</td>
                    <td>{b.scheduled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <PanelEmpty
          icon={CalendarPlus}
          title="No events on the calendar yet"
          action={
            <PanelLink to="/admin/events?new=1">
              Create the first event
            </PanelLink>
          }
        >
          Each week's played and scheduled games appear here once events are
          created.
        </PanelEmpty>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Athletes by college: registered athlete accounts, men and women.
   ═══════════════════════════════════════════════════════════════════════ */

function AthletesByCollege({
  athletes,
  departments,
  abbreviate,
  className,
}: {
  athletes: any[];
  departments: any[];
  abbreviate: Abbr;
  className?: string;
}) {
  const rows = useMemo(() => {
    const by = new Map<
      string,
      { name: string; label: string; men: number; women: number; total: number }
    >();
    const row = (name: string) => {
      if (!by.has(name))
        by.set(name, {
          name,
          label: shortDeptLabel(abbreviate, name, 12),
          men: 0,
          women: 0,
          total: 0,
        });
      return by.get(name)!;
    };
    // Every college is listed, so one with no athletes shows as zero
    // instead of going missing.
    departments.forEach((d) => d?.name && row(d.name));
    athletes.forEach((a) => {
      const r = row(a.department || "No college");
      const g = String(a.gender ?? "").toLowerCase();
      if (g === "male") r.men++;
      else if (g === "female") r.women++;
      r.total++;
    });
    return [...by.values()].sort(
      (a, b) => b.total - a.total || a.label.localeCompare(b.label),
    );
  }, [athletes, departments, abbreviate]);

  const total = athletes.length;
  const color = (i: number) => COLLEGE_COLORS[i % COLLEGE_COLORS.length];

  return (
    <Panel
      className={className}
      title="Athletes by college"
      description={`${total.toLocaleString()} registered athlete ${total === 1 ? "account" : "accounts"}`}
      action={<PanelLink to="/admin/users">Users</PanelLink>}
    >
      {total ? (
        <>
          <div
            className="chart-sweep relative mx-auto size-44"
            role="img"
            aria-label="Registered athletes per college"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows.filter((r) => r.total > 0)}
                  dataKey="total"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={2}
                  cornerRadius={3}
                  startAngle={90}
                  endAngle={-270}
                  stroke="var(--surface)"
                  strokeWidth={1}
                  isAnimationActive={false}
                >
                  {rows
                    .filter((r) => r.total > 0)
                    .map((r) => (
                      <Cell key={r.name} fill={color(rows.indexOf(r))} />
                    ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as (typeof rows)[number];
                    return (
                      <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-3)]">
                        <p className="font-semibold text-text">{r.name}</p>
                        <p className="text-text-secondary">
                          {r.total} athletes · {r.men} men · {r.women} women
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="numeral text-2xl leading-none text-text">
                {total.toLocaleString()}
              </span>
              <span className="t-caption mt-1">athletes</span>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5 text-[0.8125rem]">
            {rows.map((r, i) => (
              <li
                key={r.name}
                className="chart-rise flex min-w-0 items-center gap-2"
                style={{ animationDelay: `${120 + i * 40}ms` }}
                title={`${r.name}: ${r.men} men, ${r.women} women`}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: color(i) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate font-medium text-text">
                  {r.label}
                </span>
                <span className="t-caption shrink-0 whitespace-nowrap">
                  {r.men}M · {r.women}W
                </span>
                <span className="numeral w-8 shrink-0 text-right text-text">
                  {r.total}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <PanelEmpty icon={Users} title="No athletes registered yet">
          Each college's count shows here as students sign up as athletes.
        </PanelEmpty>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   College standings: points from scored events.
   ═══════════════════════════════════════════════════════════════════════ */

function CollegeMark({
  name,
  dept,
  abbreviate,
}: {
  name: string;
  dept?: any;
  abbreviate: Abbr;
}) {
  // A real logo only; the college's short name already sits beside it, so a
  // letter badge would just repeat it (and "CAS" / "CABEIHM" would collide).
  const logo = dept?.logo_url ?? dept?.logoUrl;
  if (!logo) return null;
  return (
    <img
      src={logo}
      alt=""
      title={abbreviate(name)}
      className="size-6 shrink-0 rounded-full border border-border bg-surface object-contain"
    />
  );
}

function Standings({
  rows,
  abbreviate,
  deptByName,
  className,
}: {
  rows: any[];
  abbreviate: Abbr;
  deptByName: Map<string, any>;
  className?: string;
}) {
  // The server already orders the rows by the office's ranking rules.
  // Olympic-style standings have no points column.
  const usesPoints = rows.some((r) => r.points != null);
  const ranked = rows
    .map((r) => ({
      name: String(r.department ?? ""),
      gold: Number(r.gold ?? 0),
      silver: Number(r.silver ?? 0),
      bronze: Number(r.bronze ?? 0),
      points: Number(r.points ?? 0),
    }))
    .filter(
      (r) => r.name && (r.points > 0 || r.gold + r.silver + r.bronze > 0),
    )
    .slice(0, 7);

  const medalHead = (label: string, color: string) => (
    <th scope="col" className="w-8 pb-2 text-right font-medium">
      <span className="inline-flex items-center gap-1">
        <span
          className="size-2 rounded-full"
          style={{ background: color }}
          aria-hidden="true"
        />
        <abbr title={label} className="no-underline">
          {label[0]}
        </abbr>
      </span>
    </th>
  );

  return (
    <Panel
      className={className}
      title="College standings"
      description={
        usesPoints ? "Medals won and the points they earn" : "Medals won"
      }
      action={<PanelLink to="/leaderboard">Full table</PanelLink>}
    >
      {ranked.length ? (
        <table className="w-full text-[0.8125rem]">
          <thead className="t-caption">
            <tr className="border-b border-border-subtle">
              <th scope="col" className="pb-2 text-left font-medium">
                College
              </th>
              {medalHead("Gold", "#CB8B2E")}
              {medalHead("Silver", "#A9A19E")}
              {medalHead("Bronze", "#8A5A1E")}
              {usesPoints && (
                <th scope="col" className="w-12 pb-2 text-right font-medium">
                  Points
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {ranked.map((r, i) => (
              <tr key={r.name}>
                <td className="max-w-0 py-2 pr-3">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "numeral w-4 shrink-0 text-right",
                        i === 0 ? "text-brand-text" : "text-text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <CollegeMark
                      name={r.name}
                      dept={deptByName.get(r.name)}
                      abbreviate={abbreviate}
                    />
                    <span
                      className="truncate font-medium text-text"
                      title={r.name}
                    >
                      {shortDeptLabel(abbreviate, r.name, 26)}
                    </span>
                  </span>
                </td>
                <td className="numeral py-2 text-right text-text">{r.gold}</td>
                <td className="numeral py-2 text-right text-text-secondary">
                  {r.silver}
                </td>
                <td className="numeral py-2 text-right text-text-secondary">
                  {r.bronze}
                </td>
                {usesPoints && (
                  <td className="numeral py-2 text-right text-text">
                    {r.points.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <PanelEmpty icon={Trophy} title="No medals yet">
          Standings fill in as judged events are scored and brackets crown
          their podiums.
        </PanelEmpty>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Game day: a day's games by venue, and what is next. An intramurals day is
   dozens of games running side by side on courts and tables, so a flat
   "upcoming" list showed only the first few of one time slot.
   ═══════════════════════════════════════════════════════════════════════ */

type GameStatus = "final" | "live" | "overdue" | "scheduled";

/** "Badminton Hall — Court 2" → ["Badminton Hall", "Court 2"]. */
function splitVenue(v?: string | null): [string, string | null] {
  const name = String(v ?? "").trim();
  if (!name) return ["No venue set", null];
  const i = name.indexOf(" — ");
  return i > 0 ? [name.slice(0, i), name.slice(i + 3)] : [name, null];
}

function minutesOf(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return Number.isNaN(h) ? null : h * 60 + (m || 0);
}

function gameStatus(e: any, isToday: boolean, nowMin: number): GameStatus {
  if (e.status === "completed") return "final";
  // Ongoing covers both live scoring and a game scored on paper.
  if (e.status === "ongoing") return "live";
  const start = minutesOf(e.startTime);
  if (isToday && start !== null && start <= nowMin) return "overdue";
  return "scheduled";
}

const GAME_STATUS: Record<GameStatus, { label: string; color: string }> = {
  final: { label: "Final", color: "var(--color-ink-400)" },
  live: { label: "Under way", color: PLAYED },
  overdue: { label: "Overdue", color: NOT_CLOSED },
  scheduled: { label: "To play", color: SCHEDULED },
};

function StatusChip({ status }: { status: GameStatus }) {
  if (status === "scheduled") return null;
  const cls =
    status === "live"
      ? "bg-brand-subtle text-brand-text"
      : status === "overdue"
        ? "bg-warning-subtle text-warning-foreground"
        : "bg-bg-subtle text-text-secondary";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap",
        cls,
      )}
    >
      {status === "live" && (
        <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
      )}
      {GAME_STATUS[status].label}
    </span>
  );
}

function GameDay({
  events,
  today,
  now,
  abbreviate,
  className,
}: {
  events: any[];
  today: Date;
  now: Date;
  abbreviate: Abbr;
  className?: string;
}) {
  const todayIso = isoDay(today);

  // Today, then each of the next six days that has games.
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      const d = String(e.schedule ?? "").slice(0, 10);
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    });
    const out: { iso: string; date: Date; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getTime() + i * DAY);
      const iso = isoDay(date);
      const count = counts.get(iso) ?? 0;
      if (i === 0 || count > 0) out.push({ iso, date, count });
    }
    return out;
  }, [events, today]);

  const [picked, setPicked] = useState<string | null>(null);
  const firstWithGames = days.find((d) => d.count > 0)?.iso ?? todayIso;
  const dayIso = picked ?? firstWithGames;
  const isToday = dayIso === todayIso;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const games = useMemo(
    () =>
      events
        .filter((e) => String(e.schedule ?? "").slice(0, 10) === dayIso)
        .map((e) => {
          const [venue, spot] = splitVenue(e.venueName);
          return {
            e,
            venue,
            spot,
            start: minutesOf(e.startTime),
            status: gameStatus(e, isToday, nowMin),
          };
        })
        .sort(
          (a, b) =>
            (a.start ?? 9999) - (b.start ?? 9999) ||
            String(a.e.venueName ?? "").localeCompare(String(b.e.venueName ?? "")),
        ),
    [events, dayIso, isToday, nowMin],
  );

  const venues = useMemo(() => {
    const by = new Map<
      string,
      { name: string; spots: Set<string>; counts: Record<GameStatus, number>; next: number | null }
    >();
    games.forEach((g) => {
      if (!by.has(g.venue))
        by.set(g.venue, {
          name: g.venue,
          spots: new Set(),
          counts: { final: 0, live: 0, overdue: 0, scheduled: 0 },
          next: null,
        });
      const v = by.get(g.venue)!;
      if (g.spot) v.spots.add(g.spot);
      v.counts[g.status]++;
      if (g.status !== "final" && g.start !== null && (v.next === null || g.start < v.next))
        v.next = g.start;
    });
    return [...by.values()].sort(
      (a, b) => total(b.counts) - total(a.counts) || a.name.localeCompare(b.name),
    );
  }, [games]);

  // The next time slots still to finish, up to eight games.
  const nextUp = useMemo(() => {
    const open = games.filter((g) => g.status !== "final");
    const perSlot = new Map<number | null, number>();
    open.forEach((g) => perSlot.set(g.start, (perSlot.get(g.start) ?? 0) + 1));
    const slots: { start: number | null; size: number; games: typeof open }[] = [];
    let shown = 0;
    for (const g of open) {
      if (shown >= 8) break;
      const last = slots[slots.length - 1];
      if (last && last.start === g.start) last.games.push(g);
      else {
        if (slots.length === 2) break;
        slots.push({ start: g.start, size: perSlot.get(g.start) ?? 1, games: [g] });
      }
      shown++;
    }
    return { slots, hidden: open.length - shown };
  }, [games]);

  const sum = (k: GameStatus) => games.filter((g) => g.status === k).length;
  const noCommittee = games.filter(
    (g) => g.status !== "final" && (g.e.judges || []).length === 0,
  ).length;
  const starts = games.map((g) => g.start).filter((x): x is number => x !== null);
  const clock = (m: number) =>
    fmtTime(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`);

  const summary = games.length
    ? [
        `${games.length} ${games.length === 1 ? "game" : "games"}`,
        `${venues.length} ${venues.length === 1 ? "venue" : "venues"}`,
        starts.length
          ? `${clock(Math.min(...starts))} – ${clock(Math.max(...starts))}`
          : null,
        sum("final") ? `${sum("final")} final` : null,
        sum("live") ? `${sum("live")} under way` : null,
        sum("overdue") ? `${sum("overdue")} overdue` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : isToday
      ? "No games today"
      : "No games this day";

  const dayLabel = (d: { iso: string; date: Date }) =>
    d.iso === todayIso
      ? "Today"
      : d.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

  return (
    <Panel
      className={className}
      title="Game day"
      description={summary}
      action={<PanelLink to="/admin/events">All events</PanelLink>}
      bodyClassName="px-0 pb-2"
    >
      {days.length > 1 && (
        <div
          className="flex gap-1.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Day"
        >
          {days.map((d) => {
            const on = d.iso === dayIso;
            return (
              <button
                key={d.iso}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPicked(d.iso)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.8125rem] font-medium transition-colors duration-[140ms]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
                  on
                    ? "border-text bg-text text-surface"
                    : "border-border text-text-secondary hover:bg-surface-hover",
                )}
              >
                {dayLabel(d)}
                <span className={cn("numeral text-[0.75rem]", on ? "opacity-80" : "text-text-muted")}>
                  {d.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {games.length === 0 ? (
        <div className="px-5 pb-3">
          <PanelEmpty
            icon={CalendarDays}
            title={isToday ? "No games today" : "No games this day"}
            action={<PanelLink to="/admin/events?new=1">Schedule an event</PanelLink>}
          >
            Games you schedule, or brackets you publish, show here by venue.
          </PanelEmpty>
        </div>
      ) : (
        <>
          <h3 className="t-overline border-t border-border-subtle px-5 pt-3 pb-1.5">By venue</h3>
          <ul className="px-5">
            {venues.map((v) => {
              const n = total(v.counts);
              const done = v.counts.final;
              return (
                <li key={v.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.875rem] font-medium text-text" title={v.name}>
                      {v.name}
                      {v.spots.size > 1 && (
                        <span className="t-caption ml-1.5">
                          {v.spots.size} {/table/i.test([...v.spots][0]) ? "tables" : /court/i.test([...v.spots][0]) ? "courts" : "areas"}
                        </span>
                      )}
                    </p>
                    <div
                      className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle"
                      role="img"
                      aria-label={`${done} of ${n} final at ${v.name}`}
                    >
                      {(["final", "live", "overdue", "scheduled"] as const).map((k) =>
                        v.counts[k] ? (
                          <span
                            key={k}
                            className="h-full"
                            style={{
                              width: `${(v.counts[k] / n) * 100}%`,
                              background: GAME_STATUS[k].color,
                              opacity: k === "scheduled" ? 0.35 : 1,
                            }}
                          />
                        ) : null,
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="numeral text-[0.875rem] text-text">
                      {done}
                      <span className="text-text-muted">/{n}</span>
                    </p>
                    <p className="t-caption whitespace-nowrap">
                      {v.next !== null ? `next ${clock(v.next)}` : "all final"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {nextUp.slots.length > 0 && (
            <>
              <h3 className="t-overline mt-2 border-t border-border-subtle px-5 pt-3 pb-1">Next up</h3>
              {nextUp.slots.map((slot) => (
                <div key={String(slot.start)}>
                  <p className="px-5 pt-2 pb-1 text-[0.75rem] font-semibold text-text-secondary">
                    {slot.start !== null ? clock(slot.start) : "Time not set"}
                    <span className="t-caption ml-1.5 font-normal">
                      {slot.size} {slot.size === 1 ? "game" : "games"}
                      {slot.size > slot.games.length && ` · showing ${slot.games.length}`}
                    </span>
                  </p>
                  <ul className="divide-y divide-border-subtle">
                    {slot.games.map(({ e, spot, venue, status }) => {
                      const teams: string[] = e.departments || [];
                      const matchup =
                        teams.length === 2
                          ? `${shortDeptLabel(abbreviate, teams[0], 12)} vs ${shortDeptLabel(abbreviate, teams[1], 12)}`
                          : teams.length > 2
                            ? `${teams.length} colleges`
                            : "Teams to be decided";
                      const round = String(e.name ?? "").match(/\(([^)]+)\)/)?.[1];
                      const committee = (e.judges || [])[0]?.name as string | undefined;
                      return (
                        <li key={e.id}>
                          <Link
                            to={`/admin/events?q=${encodeURIComponent(e.name)}`}
                            title={e.name}
                            className={cn(
                              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-2",
                              "md:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,9rem)_auto]",
                              "transition-colors duration-[140ms] hover:bg-surface-hover",
                              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--focus-ring)",
                            )}
                          >
                            <span className="t-caption hidden truncate md:block">{spot ?? venue}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-[0.875rem] font-medium text-text">{matchup}</span>
                              <span className="t-caption block truncate">
                                {[e.category, round].filter(Boolean).join(" · ")}
                                <span className="md:hidden"> · {spot ?? venue}</span>
                              </span>
                            </span>
                            <span className="hidden min-w-0 md:block">
                              {committee ? (
                                <span className="flex items-center gap-1.5 truncate text-[0.8125rem] text-text-secondary">
                                  <Gavel className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                                  <span className="truncate">{committee}</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-warning-foreground">
                                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                                  No committee
                                </span>
                              )}
                            </span>
                            <span className="justify-self-end">
                              <StatusChip status={status} />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {nextUp.hidden > 0 && (
                <p className="px-5 pt-2 pb-1">
                  <PanelLink to="/admin/events">
                    {nextUp.hidden} more {isToday ? "today" : "that day"}
                  </PanelLink>
                </p>
              )}
            </>
          )}
          {noCommittee > 0 && (
            <p className="mx-5 mt-2 flex items-center gap-1.5 rounded-md bg-warning-subtle px-2.5 py-1.5 text-[0.8125rem] font-medium text-warning-foreground">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {noCommittee} {noCommittee === 1 ? "game has" : "games have"} no committee assigned
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function total(c: Record<GameStatus, number>) {
  return c.final + c.live + c.overdue + c.scheduled;
}

/* ═══════════════════════════════════════════════════════════════════════
   What needs the office: requests to decide, and gaps before game day.
   ═══════════════════════════════════════════════════════════════════════ */

const TX_LABEL: Record<
  OfficeTransaction["type"],
  { label: string; icon: LucideIcon }
> = {
  cmo_requirement: { label: "CMO requirement", icon: FileBadge },
  protest: { label: "Appeal", icon: Flag },
};

function NeedsAttention({
  items,
  total,
  unstaffed,
  unclosed,
}: {
  items: OfficeTransaction[];
  total: number;
  unstaffed: number;
  unclosed: number;
}) {
  const alerts = [
    unstaffed > 0 && {
      icon: ClipboardCheck,
      text: `${unstaffed} upcoming ${unstaffed === 1 ? "event has" : "events have"} no committee assigned`,
      to: "/admin/events",
    },
    unclosed > 0 && {
      icon: AlertTriangle,
      text: `${unclosed} past ${unclosed === 1 ? "game has" : "games have"} no final result`,
      to: "/admin/events",
    },
  ].filter(Boolean) as { icon: LucideIcon; text: string; to: string }[];

  return (
    <Panel
      title="Needs attention"
      description={
        total || alerts.length
          ? `${total} ${total === 1 ? "request" : "requests"} to decide`
          : "Nothing needs a decision"
      }
      action={
        total > 0 ? (
          <PanelLink to="/admin/transactions">Open queue</PanelLink>
        ) : undefined
      }
      bodyClassName="pb-3"
    >
      {alerts.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {alerts.map((a) => (
            <li key={a.text}>
              <Link
                to={a.to}
                className={cn(
                  "flex items-center gap-2 rounded-md bg-warning-subtle px-2.5 py-2 text-[0.8125rem] font-medium text-warning-foreground",
                  "transition-colors duration-[140ms] hover:brightness-[0.98]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
                )}
              >
                <a.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{a.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <ul className="-mx-2">
          {items.map((t) => {
            const meta = TX_LABEL[t.type];
            return (
              <li key={`${t.type}-${t.id}`}>
                <Link
                  to={t.link || "/admin/transactions"}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md px-2 py-2",
                    "transition-colors duration-[140ms] hover:bg-surface-hover",
                    "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--focus-ring)",
                  )}
                >
                  <meta.icon
                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-text">
                      {t.party || t.reference}
                    </span>
                    <span className="t-caption block truncate">
                      {t.subject
                        ?.toLowerCase()
                        .startsWith(meta.label.toLowerCase())
                        ? t.subject
                        : `${meta.label} · ${t.subject}`}
                    </span>
                  </span>
                  <span className="t-caption shrink-0">
                    {timeAgo(t.filedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        alerts.length === 0 && (
          <p className="t-caption py-2">
            New CMO submissions and appeals land here for a decision.
          </p>
        )
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Loading: the same frame, so nothing jumps when data lands.
   ═══════════════════════════════════════════════════════════════════════ */

function DashboardLoading() {
  const block = "rounded-[var(--radius-lg)] border border-border bg-surface";
  return (
    <ConsolePage>
      <div
        className="mb-5 space-y-2"
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(block, "h-[7.25rem] p-4")}>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-3 h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={cn(block, "h-80 lg:col-span-8")} />
        <div className={cn(block, "h-80 lg:col-span-4")} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={cn(block, "h-80 lg:col-span-8")} />
        <div className={cn(block, "h-80 lg:col-span-4")} />
      </div>
    </ConsolePage>
  );
}
