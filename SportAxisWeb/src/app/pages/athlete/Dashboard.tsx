import { EmptyState } from "../../components/page/EmptyState";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  useMyCoach,
  useEnrollWithCode,
  useUnenrollFromCoach,
  useAthleteSchedule,
  useMyPerformance,
  useMyClearance,
  useAttendanceRecords,
} from "../../hooks/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Calendar,
  TrendingUp,
  Trophy,
  UserCheck,
  Loader2,
  LogOut,
  BookOpen,
  MapPin,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  CalendarCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface CoachInfo {
  id: string;
  name: string;
  email: string;
  sport: string;
}

interface EnrollmentState {
  enrolled: boolean;
  coach: CoachInfo | null;
  sport: string;
  enrolledAt: string;
}

// ── Enrollment Gate ────────────────────────────────────────────────────────
function EnrollmentGate({ onEnrolled }: { onEnrolled: () => void }) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const enroll = useEnrollWithCode();
  const loading = enroll.isPending;

  const handleEnroll = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast.error("Please enter a valid enrollment code");
      return;
    }
    try {
      const res = await enroll.mutateAsync(trimmed);
      toast.success(res.message || `Enrolled in ${res.coach?.sport}!`);
      onEnrolled();
    } catch (err: any) {
      toast.error(err?.message || "Invalid enrollment code");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="t-page-title mb-2">
            Join a Sports Team
          </h1>
          <p className="t-page-lede mx-auto">
            Ask your coach for their <strong>enrollment code</strong> and enter
            it below to join their team.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-text">
                  Enrollment Code
                </label>
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleEnroll()}
                  placeholder="e.g. AB1CD2"
                  className="numeral h-14 text-center text-2xl uppercase tracking-[0.3em]"
                  maxLength={8}
                  disabled={loading}
                  autoFocus
                />
                <p className="t-caption mt-2 text-center">
                  6-character code from your coach
                </p>
              </div>

              <Button
                className="w-full h-12 text-base"
                onClick={handleEnroll}
                disabled={loading || code.trim().length < 4}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Join Team
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="t-caption mt-4 text-center">
          You can only be enrolled in one sports team at a time.
        </p>
      </div>
    </div>
  );
}

// ── Athlete home ────────────────────────────────────────────────────────
function EnrolledDashboard({
  enrollment,
  userName,
  onUnenroll,
}: {
  enrollment: EnrollmentState;
  userName: string;
  onUnenroll: () => void;
}) {
  const unenroll = useUnenrollFromCoach();
  const unenrolling = unenroll.isPending;

  const scheduleQuery = useAthleteSchedule();
  const performanceQuery = useMyPerformance();
  const clearanceQuery = useMyClearance();
  const attendanceQuery = useAttendanceRecords();

  const scheduleEvents: any[] = scheduleQuery.data?.events ?? [];
  const performance: any[] = performanceQuery.data ?? [];
  const attendance: any[] = attendanceQuery.data ?? [];
  const clearance = clearanceQuery.data;

  const now = Date.now();

  const nextGame = useMemo(
    () =>
      scheduleEvents
        .filter((e) => e.status !== "completed")
        .filter((e) => {
          const t = new Date(e.schedule).getTime();
          return isNaN(t) || t >= now - 86_400_000;
        })
        .sort((a, b) => (a.schedule < b.schedule ? -1 : 1))[0] ?? null,
    [scheduleEvents, now],
  );

  const upcomingFixtures = useMemo(
    () =>
      scheduleEvents
        .filter((e) => e.status !== "completed")
        .filter((e) => {
          const t = new Date(e.schedule).getTime();
          return isNaN(t) || t >= now - 86_400_000;
        })
        .sort((a, b) => (a.schedule < b.schedule ? -1 : 1))
        .slice(0, 5),
    [scheduleEvents, now],
  );

  const latestFeedback = useMemo(() => {
    if (!performance.length) return null;
    return [...performance].sort((a, b) =>
      (b.recordedAt ?? "") < (a.recordedAt ?? "") ? -1 : 1,
    )[0];
  }, [performance]);

  const thisWeek = useMemo(() => {
    const weekAgo = now - 7 * 86_400_000;
    return attendance.filter((a) => new Date(a.date).getTime() >= weekAgo);
  }, [attendance, now]);

  const handleUnenroll = async () => {
    if (
      !confirm(
        "Are you sure you want to leave this team? You will need a new enrollment code to rejoin.",
      )
    )
      return;
    try {
      await unenroll.mutateAsync();
      toast.success("Successfully unenrolled");
      onUnenroll();
    } catch (err: any) {
      toast.error(err?.message || "Failed to unenroll");
    }
  };

  const fmtDay = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const daysUntil = (s: string) => {
    const d = Math.round(
      (new Date(s).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
        86_400_000,
    );
    if (d === 0) return "Today";
    if (d === 1) return "Tomorrow";
    if (d > 1) return `In ${d} days`;
    return fmtDay(s);
  };


  return (
    <div className="container page-container px-4 py-6 sm:py-8">
      {/* Header / team strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-page-title">
            Hello, {userName.split(" ")[0]}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-secondary">
            <Trophy className="h-4 w-4 text-primary" />
            {enrollment.sport} · Coach {enrollment.coach?.name}
          </p>
        </div>

      </div>

      {/* The four answers an athlete opens the app for */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Next game */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 t-label">
              <Calendar className="h-4 w-4" />
              Next game
            </div>
            {nextGame ? (
              <>
                <p className="t-section">
                  {daysUntil(nextGame.schedule)}
                </p>
                <p className="mt-0.5 truncate text-sm text-text-secondary">
                  {nextGame.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 t-caption">
                  {nextGame.startTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {nextGame.startTime}
                    </span>
                  )}
                  {nextGame.venueName && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {nextGame.venueName}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-text-muted">
                No upcoming games scheduled.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Clearance */}
        <Card
          className={
            clearance?.cleared === false ? "border-amber-200" : undefined
          }
        >
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 t-label">
              {clearance?.cleared ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              Clearance
            </div>
            {clearance ? (
              <>
                <p
                  className={`text-lg font-bold ${clearance.cleared ? "text-green-700" : "text-amber-700"}`}
                >
                  {clearance.cleared
                    ? "Cleared to play"
                    : `${clearance.missing.length} outstanding`}
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {clearance.approvedCount}/{clearance.requiredCount} required
                  documents approved
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">Loading…</p>
            )}
            <Link
              to="/athlete/requirements"
              className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
            >
              View requirements
              <ChevronRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Latest coach feedback */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 t-label">
              <TrendingUp className="h-4 w-4" />
              Latest feedback
            </div>
            {latestFeedback ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="t-section">
                    {latestFeedback.overallRating}/10
                  </p>
                  <Badge variant="neutral">{latestFeedback.sport}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                  {latestFeedback.coachNotes || latestFeedback.eventName}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">
                No performance records yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* This week's attendance */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 t-label">
              <CalendarCheck className="h-4 w-4" />
              This week
            </div>
            {thisWeek.length === 0 ? (
              <p className="text-sm text-text-muted">
                No attendance marked this week.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {thisWeek.map((a) => (
                  <span
                    key={a.id}
                    className={`h-2.5 w-2.5 rounded-full ${
                      a.status === "present"
                        ? "bg-green-500"
                        : a.status === "late"
                          ? "bg-amber-500"
                          : a.status === "excused"
                            ? "bg-blue-500"
                            : "bg-red-500"
                    }`}
                    title={`${a.status} · ${a.date}`}
                  />
                ))}
                <span className="ml-1 text-sm text-text-secondary">
                  {thisWeek.length} marked
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* The four cards answer "how am I doing". This answers "what is
          coming", which is the other half of why an athlete opens this page,
          and it used to be a grid of shortcuts repeating the navigation
          two inches to the left. */}
      <section className="mt-8">
        <h2 className="t-section mb-3">Your fixtures</h2>
        {upcomingFixtures.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              compact
              icon={Calendar}
              title="No fixtures scheduled"
              description="Games appear here once the Sports Office schedules your team."
            />
          </div>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {upcomingFixtures.map((e, i) => (
              <li
                key={e.id ?? i}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border-subtle px-4 py-3 last:border-0"
              >
                <span className="w-24 shrink-0 text-sm font-medium text-text">
                  {daysUntil(e.schedule)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-text">{e.name}</span>
                {e.startTime && <span className="t-caption">{e.startTime}</span>}
                {e.venueName && <span className="t-caption">{e.venueName}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Live scores is the one destination an athlete reaches for that is
          not in their own navigation. Leaving the team is a rare, reversible
          decision, not a header action. */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
        <Button asChild variant="secondary" size="sm">
          <Link to="/live">Live scores</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-muted hover:text-danger"
          onClick={handleUnenroll}
          disabled={unenrolling}
        >
          {unenrolling ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <LogOut className="mr-1.5 size-3.5" />
          )}
          Leave team
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AthleteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "athlete") navigate("/login");
  }, [user, navigate]);

  const myCoachQuery = useMyCoach();
  const checkEnrollment = () => myCoachQuery.refetch();

  const enrollment: EnrollmentState | null =
    (myCoachQuery.data as EnrollmentState | undefined) ??
    (myCoachQuery.isError
      ? { enrolled: false, coach: null, sport: "", enrolledAt: "" }
      : null);
  const loading = myCoachQuery.isLoading;

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-gray-500">Loading your portal…</p>
        </div>
      </div>
    );
  }

  if (!enrollment?.enrolled) {
    return <EnrollmentGate onEnrolled={checkEnrollment} />;
  }

  return (
    <EnrolledDashboard
      enrollment={enrollment}
      userName={user.name}
      onUnenroll={checkEnrollment}
    />
  );
}
