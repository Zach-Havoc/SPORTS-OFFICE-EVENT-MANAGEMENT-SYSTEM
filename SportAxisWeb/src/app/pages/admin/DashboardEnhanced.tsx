import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  FileBadge,
  Flag,
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
  useMatches,
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
import {
  ResultsMixedChart,
  WinRateRadar,
  collegeColorer,
} from "../../components/dashboard/DashboardCharts";
import { cn } from "../../components/ui/utils";

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
  const matchesQuery = useMatches();
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
        <ResultsMixedChart
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
        <WinRateRadar
          matches={matchesQuery.data ?? []}
          colleges={departments.map((d) => d.name)}
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
  // The same colour per college as on the radar.
  const colorOf = useMemo(() => collegeColorer(departments.map((d) => d.name)), [departments]);

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
                      <Cell key={r.name} fill={colorOf(r.name)} />
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
                  style={{ background: colorOf(r.name) }}
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
