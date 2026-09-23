import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  useEvents,
  useDepartments,
  useCategories,
  useLeaderboard,
  useJudges,
  useCoaches,
  useVenues,
  useBrackets,
  useUsers,
  useLiveScores,
} from "../../hooks/api";
import { RefreshStatus } from "../../components/RefreshStatus";
import { DashboardSkeleton } from "../../components/dashboard/DashboardSkeleton";
import {
  DashboardCanvas,
  Grid,
  Tile,
  HeroTile,
  Metric,
  IconStat,
  BareStat,
  MetricTable,
  DistBar,
  RankList,
  StackedRankBars,
  RangePicker,
  dailyCounts,
  periodDelta,
  metricRow,
  tally,
  STATUS_COLORS,
  MEDAL_COLORS,
  CHART_COLORS,
} from "../../components/dashboard/DashboardKit";
import { Calendar, GraduationCap, Users, Gavel } from "lucide-react";

export default function DashboardEnhanced() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/login");
  }, [user, navigate]);

  const eventsQuery = useEvents();
  const departmentsQuery = useDepartments();
  const categoriesQuery = useCategories();
  const leaderboardQuery = useLeaderboard();
  const judgesQuery = useJudges();
  const coachesQuery = useCoaches();
  const venuesQuery = useVenues();
  const bracketsQuery = useBrackets();
  const usersQuery = useUsers({});
  const liveScoresQuery = useLiveScores(true);

  const queries = [
    eventsQuery,
    departmentsQuery,
    categoriesQuery,
    leaderboardQuery,
    judgesQuery,
    coachesQuery,
    venuesQuery,
    bracketsQuery,
    usersQuery,
  ];

  const events: any[] = eventsQuery.data ?? [];
  const departments: any[] = departmentsQuery.data ?? [];
  const categories: any[] = categoriesQuery.data ?? [];
  const leaderboard: any[] = leaderboardQuery.data ?? [];
  const judges: any[] = judgesQuery.data ?? [];
  const coaches: any[] = coachesQuery.data ?? [];
  const venues: any[] = venuesQuery.data ?? [];
  const brackets: any[] = bracketsQuery.data ?? [];
  const users: any[] = usersQuery.data ?? [];
  const liveScores: any[] = liveScoresQuery.data ?? [];

  const loading = queries.some((q) => q.isLoading);
  const fetching = queries.some((q) => q.isFetching) && !loading;
  const backgroundError = queries.some((q) => q.isRefetchError);
  const retryAll = () => queries.forEach((q) => q.refetch());

  const [rangeA, setRangeA] = useState(7);
  const [rangeB, setRangeB] = useState(7);

  const athleteUsers = useMemo(
    () => users.filter((u) => u.role === "athlete"),
    [users],
  );
  const coachUsers = useMemo(
    () => users.filter((u) => u.role === "coach"),
    [users],
  );

  const totals = useMemo(() => {
    const byStatus = (s: string) =>
      events.filter((e) => (e.status ?? "upcoming") === s).length;
    return {
      events: events.length,
      athletes: athleteUsers.length,
      coaches: coachUsers.length || coaches.length,
      committee:
        users.filter((u) => u.role === "judge").length || judges.length,
      ongoing: byStatus("ongoing"),
      completed: byStatus("completed"),
      upcoming: byStatus("upcoming"),
      liveGames: liveScores.filter((l) => l.status === "in_progress").length,
      brackets: brackets.length,
      colleges: departments.length,
      sports: categories.length,
      venues: venues.length,
      activeAccounts: users.filter((u) => u.active !== false).length,
    };
  }, [
    events,
    athleteUsers,
    coachUsers,
    coaches,
    judges,
    users,
    liveScores,
    brackets,
    departments,
    categories,
    venues,
  ]);

  const evCreated = useMemo(
    () => periodDelta(events, "createdAt", rangeA),
    [events, rangeA],
  );
  const acctCreated = useMemo(
    () => periodDelta(users, "createdAt", rangeA),
    [users, rangeA],
  );
  const newAthletes = useMemo(
    () => periodDelta(athleteUsers, "createdAt", rangeB),
    [athleteUsers, rangeB],
  );
  const newCoaches = useMemo(
    () => periodDelta(coachUsers, "createdAt", rangeB),
    [coachUsers, rangeB],
  );

  const statusSegments = [
    {
      label: "Upcoming",
      value: totals.upcoming,
      color: STATUS_COLORS.upcoming,
    },
    { label: "Ongoing", value: totals.ongoing, color: STATUS_COLORS.ongoing },
    {
      label: "Completed",
      value: totals.completed,
      color: STATUS_COLORS.completed,
    },
  ];

  const roleSegments = [
    { label: "Athletes", value: athleteUsers.length, color: CHART_COLORS[0] },
    { label: "Coaches", value: coachUsers.length, color: CHART_COLORS[1] },
    {
      label: "Committee",
      value: users.filter((u) => u.role === "judge").length,
      color: CHART_COLORS[4],
    },
    {
      label: "Admins",
      value: users.filter((u) => u.role === "admin").length,
      color: CHART_COLORS[3],
    },
  ];

  const activityRows = useMemo(
    () => [
      metricRow("Events created", events, "createdAt"),
      metricRow("Accounts created", users, "createdAt"),
      metricRow("Athletes joined", athleteUsers, "createdAt"),
      metricRow("Coaches added", coachUsers, "createdAt"),
      metricRow("Events scheduled", events, "schedule"),
    ],
    [events, users, athleteUsers, coachUsers],
  );

  const pointsByCollege = useMemo(
    () =>
      leaderboard
        .map((r) => ({
          label: r.department ?? "—",
          value: Number(r.total ?? 0),
        }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [leaderboard],
  );

  const medalsByCollege = useMemo(
    () =>
      leaderboard
        .map((r) => ({
          name: (r.department ?? "—").split(" ")[0],
          gold: Number(r.gold ?? 0),
          silver: Number(r.silver ?? 0),
          bronze: Number(r.bronze ?? 0),
        }))
        .filter((r) => r.gold + r.silver + r.bronze > 0)
        .sort(
          (a, b) =>
            b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze,
        )
        .slice(0, 7),
    [leaderboard],
  );

  const eventsBySport = useMemo(
    () =>
      tally(
        events.map((e) => e.category),
        8,
        "Uncategorised",
      ),
    [events],
  );
  const athletesByCollege = useMemo(
    () =>
      tally(
        athleteUsers.map((u) => u.department),
        8,
      ),
    [athleteUsers],
  );

  if (loading) return <DashboardSkeleton />;

  return (
    <DashboardCanvas
      title="Admin Dashboard"
      subtitle="Sports Office — event, roster and results overview"
      right={
        <RefreshStatus
          fetching={fetching}
          error={backgroundError}
          onRetry={retryAll}
        />
      }
    >
      <Grid>
        {/* Row A */}
        <Tile title="System Totals" span={3}>
          <div className="grid grid-cols-2 gap-y-4">
            <IconStat
              icon={Calendar}
              iconClass="text-blue-500"
              value={totals.events}
              caption="Events"
            />
            <IconStat
              icon={GraduationCap}
              iconClass="text-violet-500"
              value={totals.athletes}
              caption="Athletes"
            />
            <IconStat
              icon={Users}
              iconClass="text-cyan-500"
              value={totals.coaches}
              caption="Coaches"
            />
            <IconStat
              icon={Gavel}
              iconClass="text-amber-500"
              value={totals.committee}
              caption="Committee"
            />
          </div>
        </Tile>

        <HeroTile
          title="Event & Account Activity"
          subtitle="New records created in the selected window"
          span={6}
          right={<RangePicker value={rangeA} onChange={setRangeA} />}
        >
          <Metric
            label="Events Created"
            value={evCreated.current.toLocaleString()}
            pct={evCreated.pct}
            prev={evCreated.prev.toLocaleString()}
            spark={dailyCounts(events, "createdAt", rangeA)}
          />
          <Metric
            label="Accounts Created"
            value={acctCreated.current.toLocaleString()}
            pct={acctCreated.pct}
            prev={acctCreated.prev.toLocaleString()}
            spark={dailyCounts(users, "createdAt", rangeA)}
          />
        </HeroTile>

        <Tile title="Live Now" span={3}>
          <div className="space-y-3">
            <BareStat value={totals.liveGames} label="Games in progress" />
            <BareStat value={totals.ongoing} label="Events ongoing" />
          </div>
        </Tile>

        {/* Row B */}
        <Tile title="Events by Status" span={3}>
          <DistBar segments={statusSegments} />
        </Tile>

        <HeroTile
          title="New Registrations"
          subtitle="Accounts joining by role"
          span={6}
          right={<RangePicker value={rangeB} onChange={setRangeB} />}
        >
          <Metric
            label="New Athletes"
            value={newAthletes.current.toLocaleString()}
            pct={newAthletes.pct}
            prev={newAthletes.prev.toLocaleString()}
            spark={dailyCounts(athleteUsers, "createdAt", rangeB)}
            color={CHART_COLORS[0]}
          />
          <Metric
            label="New Coaches"
            value={newCoaches.current.toLocaleString()}
            pct={newCoaches.pct}
            prev={newCoaches.prev.toLocaleString()}
            spark={dailyCounts(coachUsers, "createdAt", rangeB)}
            color={CHART_COLORS[1]}
          />
        </HeroTile>

        <Tile title="Accounts by Role" span={3}>
          <DistBar segments={roleSegments} />
        </Tile>

        {/* Row C */}
        <Tile
          title="Key Activity Metrics"
          subtitle="Last 30 days vs previous 30 days"
          span={8}
        >
          <MetricTable rows={activityRows} />
        </Tile>

        <Tile title="Season Records" span={4}>
          <div className="grid grid-cols-2 gap-x-6">
            <RecordLine label="Completed events" value={totals.completed} />
            <RecordLine label="Brackets" value={totals.brackets} />
            <RecordLine label="Colleges" value={totals.colleges} />
            <RecordLine label="Sports" value={totals.sports} />
            <RecordLine label="Venues" value={totals.venues} />
            <RecordLine label="Active accounts" value={totals.activeAccounts} />
          </div>
        </Tile>

        {/* Row D */}
        <Tile
          title="Points by College"
          subtitle="Team standings from scored events"
          span={6}
        >
          <RankList items={pointsByCollege} />
        </Tile>

        <Tile
          title="Medal Tally by College"
          subtitle="Gold, silver and bronze finishes"
          span={6}
        >
          <StackedRankBars
            data={medalsByCollege}
            keys={[
              { key: "gold", name: "Gold", color: MEDAL_COLORS.gold },
              { key: "silver", name: "Silver", color: MEDAL_COLORS.silver },
              { key: "bronze", name: "Bronze", color: MEDAL_COLORS.bronze },
            ]}
          />
        </Tile>

        {/* Row E */}
        <Tile
          title="Events by Sport"
          subtitle="Fixture count per discipline"
          span={6}
        >
          <RankList items={eventsBySport} color={CHART_COLORS[2]} />
        </Tile>

        <Tile
          title="Athletes by College"
          subtitle="Registered athlete accounts"
          span={6}
        >
          <RankList items={athletesByCollege} color={CHART_COLORS[1]} />
        </Tile>
      </Grid>
    </DashboardCanvas>
  );
}

function RecordLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
