import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Inbox,
  MapPin,
  Radio,
  ShieldCheck,
  Undo2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import {
  useAthletes,
  useAttendanceRecords,
  useAttendanceSessions,
  useCmoRoster,
  useCoachLineups,
  useCoachSchedule,
  useRequirements,
  useTryoutApplications,
} from "../../hooks/api";
import type {
  CmoRosterAthlete,
  CoachLineupGame,
  TeamScheduleEvent,
} from "../../services/api";
import { RefreshStatus } from "../../components/RefreshStatus";
import { Skeleton } from "../../components/ui/skeleton";
import {
  ConsolePage,
  EventStatusBadge,
  Panel,
  PanelEmpty,
  PanelLink,
  StatCard,
  timeAgo,
} from "../../components/dashboard/ConsoleKit";
import { periodDelta } from "../../components/dashboard/DashboardKit";
import { TrainingAttendanceChart } from "../../components/dashboard/DashboardCharts";
import { cn } from "../../components/ui/utils";

/*
 * The coach's board, in the same console vocabulary as the admin dashboard:
 * a sentence that says where the team stands, four figures that each link to
 * where they are acted on, then the games ahead, the roster's clearance for
 * the CMO, training attendance, and what is waiting on the coach.
 */

const DAY = 86_400_000;

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of a `YYYY-MM-DD` date (no timezone shift). */
function dayOf(schedule: string | null | undefined): Date | null {
  if (!schedule) return null;
  const [y, m, d] = String(schedule).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function fmtTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDay(d: Date, todayIso: string) {
  const iso = isoDay(d);
  if (iso === todayIso) return "Today";
  const tomorrow = new Date(d.getTime() - DAY);
  if (isoDay(tomorrow) === todayIso) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "vs CICS" from the schedule's opponents, or the game's own name. */
function versus(e: TeamScheduleEvent) {
  const names = (e.opponents ?? []).map((o) => o.abbreviation || o.name).filter(Boolean);
  return names.length ? `vs ${names.join(", ")}` : e.name;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "coach") navigate("/login");
  }, [user, navigate]);

  const athletesQuery = useAthletes();
  const scheduleQuery = useCoachSchedule();
  const lineupsQuery = useCoachLineups();
  const cmoQuery = useCmoRoster();
  const requirementsQuery = useRequirements();
  const tryoutsQuery = useTryoutApplications();
  const sessionsQuery = useAttendanceSessions();
  const attendanceQuery = useAttendanceRecords();

  const queries = [
    athletesQuery,
    scheduleQuery,
    lineupsQuery,
    cmoQuery,
    requirementsQuery,
    tryoutsQuery,
    sessionsQuery,
    attendanceQuery,
  ];
  const loading = queries.some((q) => q.isLoading);
  const fetching = queries.some((q) => q.isFetching) && !loading;
  const backgroundError = queries.some((q) => q.isRefetchError);
  const retryAll = () => queries.forEach((q) => q.refetch());

  const athletes: any[] = athletesQuery.data ?? [];
  const team = scheduleQuery.data?.team ?? null;
  const games: TeamScheduleEvent[] = scheduleQuery.data?.events ?? [];
  const lineupGames: CoachLineupGame[] = lineupsQuery.data?.games ?? [];
  const cmo: CmoRosterAthlete[] = cmoQuery.data ?? [];
  const requirements: any[] = requirementsQuery.data ?? [];
  const tryouts: any[] = tryoutsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const attendance: any[] = attendanceQuery.data ?? [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = isoDay(today);

  /* ── Games ahead ─────────────────────────────────────────────────────── */
  const lineupById = useMemo(
    () => new Map(lineupGames.map((g) => [g.id, g])),
    [lineupGames],
  );
  // Today onward and not finished. A past game still open is the office's
  // to close, not something ahead of the team.
  const ahead = useMemo(
    () =>
      games
        .filter((e) => {
          const d = dayOf(e.schedule);
          return d && d >= today && e.status !== "completed";
        })
        .sort(
          (a, b) =>
            String(a.schedule).localeCompare(String(b.schedule)) ||
            String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games, todayIso],
  );
  const liveNow = ahead.filter(
    (e) => e.status === "ongoing" && String(e.schedule).slice(0, 10) === todayIso,
  );
  const nextGame = liveNow[0] ?? ahead[0];
  const fortnight = ahead.filter(
    (e) => (dayOf(e.schedule) as Date).getTime() < today.getTime() + 14 * DAY,
  );
  // Games whose sport takes a line-up, still open for one, with none saved.
  const needLineup = ahead.filter((e) => {
    const g = lineupById.get(e.id);
    return g && !g.locked && g.lineupCount === 0;
  });

  /* ── People and paperwork ────────────────────────────────────────────── */
  const active = athletes.filter((a) => (a.status ?? "active") === "active").length;
  const injured = athletes.filter((a) => a.status === "injured").length;
  const inactive = athletes.filter((a) => a.status === "inactive").length;
  const joined = useMemo(() => periodDelta(athletes, "createdAt", 30), [athletes]);

  const pendingDocs = useMemo(
    () =>
      requirements
        .filter((r) => r.status === "pending")
        .sort((a, b) => String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? ""))),
    [requirements],
  );
  const pendingTryouts = useMemo(
    () =>
      tryouts
        .filter((t) => t.status === "pending")
        .sort((a, b) => String(b.appliedAt ?? "").localeCompare(String(a.appliedAt ?? ""))),
    [tryouts],
  );
  const returned = cmo.filter((a) => a.office?.status === "returned");
  // Sessions in the last two weeks where not everyone has a mark yet; older
  // ones are history, not a to-do.
  const twoWeeksAgo = isoDay(new Date(today.getTime() - 14 * DAY));
  const unfinished = sessions.filter((s) => {
    const d = String(s.date).slice(0, 10);
    return !s.complete && s.rosterCount > 0 && d <= todayIso && d >= twoWeeksAgo;
  });
  const waiting = pendingDocs.length + pendingTryouts.length + returned.length;

  /* ── Status sentence: the five-second read ───────────────────────────── */
  const sentence: string[] = [];
  if (liveNow.length) sentence.push(`${versus(liveNow[0])} is live now`);
  else if (nextGame) {
    const d = dayOf(nextGame.schedule) as Date;
    sentence.push(
      `next game ${versus(nextGame)} ${/^(Today|Tomorrow)$/.test(fmtDay(d, todayIso)) ? fmtDay(d, todayIso).toLowerCase() : `on ${fmtDay(d, todayIso)}`}`,
    );
  } else sentence.push("no games on the calendar");
  if (needLineup.length)
    sentence.push(`${plural(needLineup.length, "game needs", "games need")} a line-up`);
  if (waiting) sentence.push(`${plural(waiting, "item is", "items are")} waiting on you`);

  if (!user) return null;
  if (loading) return <DashboardLoading />;

  const firstName = (user.name ?? "").split(" ")[0];
  const teamLine = team?.college
    ? [team.collegeAbbreviation || team.college, ...(team.sports ?? [])].join(" · ")
    : null;

  return (
    <ConsolePage>
      {/* ── Greeting and state of play ─────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="t-page-title">
            {greeting(now)}
            {firstName ? `, Coach ${firstName}` : ""}
          </h1>
          <p className="t-supporting mt-1">
            <span className="text-text">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </span>
            {teamLine && (
              <>
                <span className="mx-1.5 text-text-muted" aria-hidden="true">·</span>
                {teamLine}
              </>
            )}
            <span className="mx-1.5 text-text-muted" aria-hidden="true">·</span>
            {sentence.join(", ").replace(/^./, (c) => c.toUpperCase())}.
          </p>
        </div>
        <RefreshStatus fetching={fetching} error={backgroundError} onRetry={retryAll} />
      </div>

      {/* ── Headline figures ──────────────────────────────────────────── */}
      <div
        className={cn(
          "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4",
          "[&>*]:w-[16.5rem] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto",
        )}
      >
        {liveNow.length ? (
          <StatCard
            icon={Radio}
            label="Live now"
            value={liveNow.length}
            live
            tone="live"
            to="/live"
            detail={`${versus(liveNow[0])} · open the live board`}
          />
        ) : (
          <StatCard
            icon={CalendarDays}
            label="Games · 14 days"
            value={fortnight.length}
            tone="scheduled"
            to="/coach/schedule"
            detail={
              nextGame
                ? `Next: ${versus(nextGame)} · ${fmtDay(dayOf(nextGame.schedule) as Date, todayIso)}${nextGame.startTime ? `, ${fmtTime(nextGame.startTime)}` : ""}`
                : "Nothing on the calendar"
            }
          />
        )}
        <StatCard
          icon={ClipboardList}
          label="Line-ups to set"
          value={needLineup.length}
          tone={needLineup.length ? "attention" : "neutral"}
          to="/coach/lineup"
          detail={
            needLineup.length
              ? `First: ${versus(needLineup[0])} · ${fmtDay(dayOf(needLineup[0].schedule) as Date, todayIso)}`
              : "Every game ahead has its line-up"
          }
        />
        <StatCard
          icon={Inbox}
          label="Waiting on you"
          value={waiting}
          tone={waiting ? "attention" : "neutral"}
          to={pendingDocs.length || returned.length ? "/coach/requirements" : "/coach/tryouts"}
          detail={
            waiting
              ? [
                  pendingDocs.length && plural(pendingDocs.length, "document", "documents"),
                  pendingTryouts.length && plural(pendingTryouts.length, "tryout applicant", "tryout applicants"),
                  returned.length && `${returned.length} returned by the office`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Nothing to decide"
          }
        />
        <StatCard
          icon={Users}
          label="Roster"
          value={athletes.length}
          to="/coach/athletes"
          delta={
            joined.current || joined.prev
              ? {
                  value: joined.current,
                  label: `athletes added in the last 30 days (previous 30 days: ${joined.prev})`,
                }
              : null
          }
          detail={[`${active} active`, injured && `${injured} injured`, inactive && `${inactive} inactive`]
            .filter(Boolean)
            .join(" · ")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <GamesAhead
          games={ahead.slice(0, 6)}
          total={ahead.length}
          lineupById={lineupById}
          todayIso={todayIso}
          className="lg:col-span-8"
        />
        <RosterClearance roster={cmo} className="lg:col-span-4" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <TrainingAttendanceChart
          sessions={sessions}
          records={attendance}
          className="lg:col-span-8"
        />
        <WaitingOnYou
          docs={pendingDocs}
          tryouts={pendingTryouts}
          returned={returned}
          unfinished={unfinished.length}
          className="lg:col-span-4"
        />
      </div>
    </ConsolePage>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Games ahead, each with where its line-up stands.
   ═══════════════════════════════════════════════════════════════════════ */

function LineupChip({ game }: { game?: CoachLineupGame }) {
  // Sports without line-ups (judged events) show nothing.
  if (!game) return null;
  if (game.lineupCount > 0)
    return (
      <span className="inline-flex items-center rounded-sm bg-success-subtle px-1.5 py-0.5 text-[0.6875rem] font-semibold text-success-foreground">
        Line-up · {game.lineupCount}
      </span>
    );
  if (game.locked)
    return (
      <span className="inline-flex items-center rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[0.6875rem] font-semibold text-text-secondary">
        No line-up
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-sm bg-warning-subtle px-1.5 py-0.5 text-[0.6875rem] font-semibold text-warning-foreground">
      Set line-up
    </span>
  );
}

function GamesAhead({
  games,
  total,
  lineupById,
  todayIso,
  className,
}: {
  games: TeamScheduleEvent[];
  total: number;
  lineupById: Map<string, CoachLineupGame>;
  todayIso: string;
  className?: string;
}) {
  return (
    <Panel
      className={className}
      title="Games ahead"
      description={
        total
          ? `${plural(total, "game", "games")} on your team's calendar${total > games.length ? `, the next ${games.length} shown` : ""}`
          : "Your team's fixtures, as the office schedules them"
      }
      action={<PanelLink to="/coach/schedule">Schedule</PanelLink>}
      bodyClassName="pb-3"
    >
      {games.length ? (
        <ul className="-mx-2">
          {games.map((e) => {
            const d = dayOf(e.schedule) as Date;
            const lineup = lineupById.get(e.id);
            return (
              <li key={e.id}>
                <Link
                  to={lineup && !lineup.locked ? "/coach/lineup" : "/coach/schedule"}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2.5",
                    "transition-colors duration-[140ms] hover:bg-surface-hover",
                    "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--focus-ring)",
                  )}
                >
                  {/* Date block: the day reads first. */}
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-md border border-border-subtle py-1">
                    <span className="t-caption text-[0.625rem] uppercase tracking-wide">
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="numeral text-lg leading-none text-text">{d.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[0.875rem] font-semibold text-text">{versus(e)}</span>
                      {/* Everything here is scheduled; only a live game needs saying. */}
                      {e.status === "ongoing" && <EventStatusBadge status={e.status} />}
                    </span>
                    <span className="t-caption mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2">
                      <span>{e.category}</span>
                      <span>
                        {fmtDay(d, todayIso)}
                        {e.startTime ? `, ${fmtTime(e.startTime)}` : ""}
                      </span>
                      {e.venueName && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{e.venueName}</span>
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <LineupChip game={lineup} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <PanelEmpty icon={CalendarClock} title="No games ahead">
          When the office schedules a game for your college and sport, it shows here.
        </PanelEmpty>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Roster clearance: where each athlete stands on the way to the CMO.
   ═══════════════════════════════════════════════════════════════════════ */

const CLEARANCE: { key: string; label: string; color: string }[] = [
  { key: "accepted", label: "Accepted by the office", color: "#307A4F" },
  { key: "submitted", label: "Forwarded, awaiting the office", color: "#0092A0" },
  { key: "ready", label: "Cleared, not forwarded yet", color: "#436590" },
  { key: "returned", label: "Returned by the office", color: "#B91A1B" },
  { key: "missing", label: "Missing documents", color: "#C98A1C" },
];

function clearanceOf(a: CmoRosterAthlete) {
  if (a.office?.status === "accepted") return "accepted";
  if (a.office?.status === "submitted") return "submitted";
  if (a.office?.status === "returned") return "returned";
  return a.cleared ? "ready" : "missing";
}

function RosterClearance({ roster, className }: { roster: CmoRosterAthlete[]; className?: string }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    roster.forEach((a) => {
      const k = clearanceOf(a);
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [roster]);

  // The document holding most athletes back.
  const topMissing = useMemo(() => {
    const by = new Map<string, number>();
    roster.forEach((a) => {
      if (a.cleared) return;
      a.missing.forEach((m) => by.set(m, (by.get(m) ?? 0) + 1));
    });
    return [...by.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [roster]);

  const total = roster.length;
  const accepted = counts.accepted ?? 0;

  return (
    <Panel
      className={className}
      title="Roster clearance"
      description={
        total
          ? `${accepted} of ${plural(total, "athlete", "athletes")} accepted by the office for the CMO`
          : "Each athlete's documents, on the way to the CMO"
      }
      action={<PanelLink to="/coach/requirements">Requirements</PanelLink>}
    >
      {total ? (
        <>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-bg-subtle"
            role="img"
            aria-label={CLEARANCE.map((s) => `${s.label}: ${counts[s.key] ?? 0}`).join(", ")}
          >
            {CLEARANCE.map((s) =>
              counts[s.key] ? (
                <span
                  key={s.key}
                  className="chart-reveal h-full"
                  style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 space-y-2 text-[0.8125rem]">
            {CLEARANCE.map((s, i) => (
              <li
                key={s.key}
                className="chart-rise flex items-center gap-2"
                style={{ animationDelay: `${120 + i * 40}ms` }}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className={cn("min-w-0 flex-1 truncate", counts[s.key] ? "text-text" : "text-text-muted")}>
                  {s.label}
                </span>
                <span className={cn("numeral w-8 shrink-0 text-right", counts[s.key] ? "text-text" : "text-text-muted")}>
                  {counts[s.key] ?? 0}
                </span>
              </li>
            ))}
          </ul>
          {topMissing && (
            <p className="t-caption mt-4 border-t border-border-subtle pt-3">
              Most often missing: <span className="font-medium text-text">{topMissing[0]}</span>{" "}
              ({plural(topMissing[1], "athlete", "athletes")})
            </p>
          )}
        </>
      ) : (
        <PanelEmpty icon={ShieldCheck} title="No athletes on your roster yet">
          As athletes join and upload their documents, their clearance shows here.
        </PanelEmpty>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Waiting on you: documents, applicants, returns, unfinished attendance.
   ═══════════════════════════════════════════════════════════════════════ */

function WaitingOnYou({
  docs,
  tryouts,
  returned,
  unfinished,
  className,
}: {
  docs: any[];
  tryouts: any[];
  returned: CmoRosterAthlete[];
  unfinished: number;
  className?: string;
}) {
  const alerts = [
    returned.length > 0 && {
      icon: Undo2,
      text: `${plural(returned.length, "athlete was", "athletes were")} returned by the office`,
      to: "/coach/requirements",
    },
    unfinished > 0 && {
      icon: ClipboardCheck,
      text: `${plural(unfinished, "recent session has", "recent sessions have")} athletes not marked`,
      to: "/coach/attendance",
    },
  ].filter(Boolean) as { icon: LucideIcon; text: string; to: string }[];

  type Row = { key: string; icon: LucideIcon; who: string; what: string; when?: string; to: string };
  const rows: Row[] = [
    ...docs.map((r) => ({
      key: `doc-${r.id}`,
      icon: FileText,
      who: r.athleteName || "Athlete",
      what: `Document · ${r.name || r.type || "to review"}`,
      when: r.submittedAt,
      to: "/coach/requirements",
    })),
    ...tryouts.map((t) => ({
      key: `try-${t.id}`,
      icon: UserPlus,
      who: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "Applicant",
      what: `Tryout · ${t.sport || "applicant"}`,
      when: t.appliedAt,
      to: "/coach/tryouts",
    })),
  ]
    .sort((a, b) => String(b.when ?? "").localeCompare(String(a.when ?? "")))
    .slice(0, 5);
  const total = docs.length + tryouts.length;

  return (
    <Panel
      className={className}
      title="Waiting on you"
      description={
        total || alerts.length
          ? `${plural(total, "decision", "decisions")} to make`
          : "Nothing needs a decision"
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
                <span>{a.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 ? (
        <ul className="-mx-2">
          {rows.map((r) => (
            <li key={r.key}>
              <Link
                to={r.to}
                className={cn(
                  "flex items-start gap-2.5 rounded-md px-2 py-2",
                  "transition-colors duration-[140ms] hover:bg-surface-hover",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--focus-ring)",
                )}
              >
                <r.icon className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-text">{r.who}</span>
                  <span className="t-caption block truncate">{r.what}</span>
                </span>
                <span className="t-caption shrink-0">{timeAgo(r.when)}</span>
              </Link>
            </li>
          ))}
          {total > rows.length && (
            <li className="t-caption px-2 pt-1">and {total - rows.length} more</li>
          )}
        </ul>
      ) : (
        alerts.length === 0 && (
          <p className="t-caption py-2">
            Documents your athletes upload and new tryout applicants land here.
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
      <div className="mb-5 space-y-2" aria-busy="true" aria-label="Loading dashboard">
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
