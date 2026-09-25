import { AttentionBand } from "../../components/dashboard/AttentionBand";
import { StatStrip } from "../../components/page/StatStrip";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  useAthletes,
  useCoachSchedule,
  useAttendanceRecords,
  usePerformanceRecords,
  useRequirements,
  useTryoutApplications,
} from "../../hooks/api";
import { RefreshStatus } from "../../components/RefreshStatus";
import { Badge } from "../../components/ui/badge";
import Loading from "../../components/Loading";
import {
  DashboardCanvas,
  Grid,
  Tile,
  HeroTile,
  Metric,
  BareStat,
  MetricTable,
  DistBar,
  RankList,
  RangePicker,
  Empty,
  RadialProgress,
  dailyCounts,
  periodDelta,
  metricRow,
  tally,
  ATTENDANCE_COLORS,
  REQUIREMENT_COLORS,
  CHART_COLORS,
} from "../../components/dashboard/DashboardKit";
import {
  CalendarClock,
  ClipboardCheck,
  UserPlus,
  MapPin,
} from "lucide-react";

interface TryoutApplication {
  id: string;
  sport: string;
  firstName: string;
  lastName: string;
  department: string;
  yearLevel: string;
  appliedAt: string;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "coach") navigate("/login");
  }, [user, navigate]);

  const athletesQuery = useAthletes();
  const scheduleQuery = useCoachSchedule();
  const attendanceQuery = useAttendanceRecords();
  const performanceQuery = usePerformanceRecords();
  const requirementsQuery = useRequirements();
  const tryoutsQuery = useTryoutApplications();

  const queries = [
    athletesQuery,
    scheduleQuery,
    attendanceQuery,
    performanceQuery,
    requirementsQuery,
    tryoutsQuery,
  ];

  const athletes: any[] = athletesQuery.data ?? [];
  const scheduleEvents: any[] = scheduleQuery.data?.events ?? [];
  const attendance: any[] = attendanceQuery.data ?? [];
  const performance: any[] = performanceQuery.data ?? [];
  const requirements: any[] = requirementsQuery.data ?? [];
  const tryouts: TryoutApplication[] = tryoutsQuery.data ?? [];

  const loading = queries.some((q) => q.isLoading);
  const fetching = queries.some((q) => q.isFetching) && !loading;
  const backgroundError = queries.some((q) => q.isRefetchError);
  const retryAll = () => queries.forEach((q) => q.refetch());

  const [rangeA, setRangeA] = useState(7);
  const [rangeB, setRangeB] = useState(7);

  const now = Date.now();

  const upcomingGames = useMemo(
    () =>
      scheduleEvents
        .filter((e) => e.status !== "completed")
        .filter((e) => {
          const t = new Date(e.schedule).getTime();
          return isNaN(t) || t >= now - 86_400_000;
        })
        .sort((a, b) => (a.schedule < b.schedule ? -1 : 1)),
    [scheduleEvents, now],
  );

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return null;
    const present = attendance.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  const avgRating = useMemo(() => {
    const rated = performance
      .map((p) => Number(p.overallRating ?? p.overall_rating))
      .filter((n) => n > 0);
    if (!rated.length) return null;
    return (rated.reduce((s, n) => s + n, 0) / rated.length).toFixed(1);
  }, [performance]);

  const pendingRequirements = requirements.filter(
    (r) => r.status === "pending",
  ).length;
  const approvedRequirements = requirements.filter(
    (r) => r.status === "approved",
  ).length;

  const attMarks = useMemo(
    () => periodDelta(attendance, "date", rangeA),
    [attendance, rangeA],
  );
  const perfRecs = useMemo(
    () => periodDelta(performance, "recordedAt", rangeA),
    [performance, rangeA],
  );
  const reqSubmitted = useMemo(
    () => periodDelta(requirements, "submittedAt", rangeB),
    [requirements, rangeB],
  );

  const rosterBySport = useMemo(
    () =>
      tally(
        athletes.map((a) => a.sport),
        8,
        "Unassigned",
      ),
    [athletes],
  );

  const attendanceSegments = useMemo(
    () =>
      (["present", "late", "excused", "absent"] as const)
        .map((k) => ({
          label: k[0].toUpperCase() + k.slice(1),
          value: attendance.filter((a) => a.status === k).length,
          color: ATTENDANCE_COLORS[k],
        }))
        .filter((s) => s.value > 0),
    [attendance],
  );

  const requirementSegments = useMemo(
    () =>
      (["approved", "pending", "rejected"] as const).map((k) => ({
        label: k[0].toUpperCase() + k.slice(1),
        value: requirements.filter((r) => r.status === k).length,
        color: REQUIREMENT_COLORS[k],
      })),
    [requirements],
  );

  const activityRows = useMemo(
    () => [
      metricRow("Attendance marks", attendance, "date"),
      metricRow("Performance records", performance, "recordedAt"),
      metricRow("Requirements submitted", requirements, "submittedAt"),
      metricRow("Athletes joined", athletes, "createdAt"),
    ],
    [attendance, performance, requirements, athletes],
  );

  const fmtDay = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  if (!user) return null;
  if (loading)
    return <Loading fullScreen={false} message="Loading dashboard…" />;

  return (
    <DashboardCanvas
      title="Coach Dashboard"
      subtitle={`Welcome back, ${user.name}`}
      right={
        <RefreshStatus
          fetching={fetching}
          error={backgroundError}
          onRetry={retryAll}
        />
      }
    >
      {/* What a coach opens this page to find out. Each entry hides itself
          when there is nothing to report, so a settled week shows a settled
          band instead of a row of zeroes. */}
      <AttentionBand
        items={[
          {
            count: pendingRequirements,
            label: pendingRequirements === 1 ? "document to review" : "documents to review",
            detail: "Athletes are waiting on your decision",
            to: "/coach/requirements",
            icon: ClipboardCheck,
            tone: "action",
          },
          {
            count: tryouts.length,
            label: tryouts.length === 1 ? "tryout application" : "tryout applications",
            detail: "New athletes asking to join your roster",
            to: "/coach/athletes",
            icon: UserPlus,
            tone: "action",
          },
          {
            count: upcomingGames.length,
            label: upcomingGames.length === 1 ? "upcoming game" : "upcoming games",
            detail: "Check your line-up before each fixture",
            to: "/coach/schedule",
            icon: CalendarClock,
            tone: "info",
          },
        ]}
      />

      <StatStrip
        stats={[
          { label: "Athletes", value: athletes.length },
          { label: "Upcoming", value: upcomingGames.length },
          { label: "Pending reqs", value: pendingRequirements },
          { label: "Tryouts", value: tryouts.length },
        ]}
      />

      <Grid>
        <HeroTile
          title="Session activity"
          subtitle="Records logged in the selected window"
          span={6}
          right={<RangePicker value={rangeA} onChange={setRangeA} />}
        >
          <Metric
            label="Attendance Marks"
            value={attMarks.current.toLocaleString()}
            pct={attMarks.pct}
            prev={attMarks.prev.toLocaleString()}
            spark={dailyCounts(attendance, "date", rangeA)}
            color={CHART_COLORS[0]}
          />
          <Metric
            label="Performance Records"
            value={perfRecs.current.toLocaleString()}
            pct={perfRecs.pct}
            prev={perfRecs.prev.toLocaleString()}
            spark={dailyCounts(performance, "recordedAt", rangeA)}
            color={CHART_COLORS[3]}
          />
        </HeroTile>

        <Tile title="Team health" span={3}>
          <div className="flex items-center justify-around gap-3">
            {attendanceRate == null ? (
              <BareStat value="—" label="Attendance rate" />
            ) : (
              <RadialProgress pct={attendanceRate} label="Attendance rate" color={ATTENDANCE_COLORS.present} />
            )}
            <BareStat
              value={avgRating == null ? "—" : `${avgRating}/10`}
              label="Avg. performance rating"
            />
          </div>
        </Tile>

        {/* Row B */}
        <Tile title="Requirements by status" span={3}>
          <DistBar segments={requirementSegments} />
        </Tile>

        <HeroTile
          title="Requirements review"
          subtitle="Documents from your athletes"
          span={6}
          right={<RangePicker value={rangeB} onChange={setRangeB} />}
        >
          <Metric
            label="Submitted"
            value={reqSubmitted.current.toLocaleString()}
            pct={reqSubmitted.pct}
            prev={reqSubmitted.prev.toLocaleString()}
            spark={dailyCounts(requirements, "submittedAt", rangeB)}
            color={CHART_COLORS[4]}
          />
          <Metric
            label="Approved"
            value={approvedRequirements.toLocaleString()}
          />
        </HeroTile>

        <Tile title="Roster by sport" span={3}>
          <RankList items={rosterBySport} unit="" />
        </Tile>

        {/* Row C */}
        <Tile
          title="Roster activity metrics"
          subtitle="Last 30 days vs previous 30 days"
          span={8}
        >
          <MetricTable rows={activityRows} />
        </Tile>

        <Tile
          title="Attendance breakdown"
          subtitle="Every mark you have recorded"
          span={4}
        >
          <DistBar segments={attendanceSegments} />
        </Tile>

        {/* Row D */}
        <Tile title="Upcoming games" subtitle="Your next fixtures" span={6}>
          {upcomingGames.length === 0 ? (
            <Empty h={180} msg="No upcoming games scheduled" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingGames.slice(0, 6).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {e.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{e.category}</span>
                      {e.venueName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {e.venueName}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-slate-600">
                      {fmtDay(e.schedule)}
                    </p>
                    {e.startTime && (
                      <p className="text-[11px] text-slate-400">
                        {e.startTime}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        <Tile
          title="Recent tryout applications"
          subtitle="Students applying through your announcements"
          span={6}
        >
          {tryouts.length === 0 ? (
            <Empty h={180} msg="No tryout applications yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tryouts.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {a.firstName} {a.lastName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {a.department} &middot; {a.yearLevel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.sport && <Badge variant="neutral">{a.sport}</Badge>}
                    <Link
                      to="/coach/athletes"
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </Grid>
    </DashboardCanvas>
  );
}
