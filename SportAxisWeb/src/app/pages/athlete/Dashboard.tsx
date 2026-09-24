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
  FileText,
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
  Users,
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join a Sports Team
          </h1>
          <p className="text-gray-500 leading-relaxed">
            Ask your coach for their <strong>enrollment code</strong> and enter
            it below to join their team.
          </p>
        </div>

        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6 pb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enrollment Code
                </label>
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleEnroll()}
                  placeholder="e.g. AB1CD2"
                  className="text-center text-2xl font-black tracking-[0.3em] uppercase h-14 font-mono"
                  maxLength={8}
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-gray-400 text-center mt-2">
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

        <p className="text-center text-xs text-gray-400 mt-4">
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

  const quickLinks = [
    { to: "/athlete/schedule", icon: Calendar, label: "Schedule" },
    { to: "/athlete/performance", icon: TrendingUp, label: "Performance" },
    { to: "/athlete/requirements", icon: FileText, label: "Requirements" },
    { to: "/athlete/attendance", icon: CalendarCheck, label: "Attendance" },
    { to: "/athlete/team", icon: Users, label: "My Team" },
    { to: "/live", icon: Trophy, label: "Live Scores" },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Header / team strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Hello, {userName.split(" ")[0]}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
            <Trophy className="h-4 w-4 text-primary" />
            {enrollment.sport} · Coach {enrollment.coach?.name}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 text-red-600 hover:bg-red-50"
          onClick={handleUnenroll}
          disabled={unenrolling}
        >
          {unenrolling ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
          )}
          Leave team
        </Button>
      </div>

      {/* The four answers an athlete opens the app for */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Next game */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Calendar className="h-4 w-4" />
              Next Game
            </div>
            {nextGame ? (
              <>
                <p className="text-lg font-bold text-gray-900">
                  {daysUntil(nextGame.schedule)}
                </p>
                <p className="mt-0.5 truncate text-sm text-gray-700">
                  {nextGame.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
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
              <p className="text-sm text-gray-400">
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
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
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
                <p className="mt-0.5 text-sm text-gray-500">
                  {clearance.approvedCount}/{clearance.requiredCount} required
                  documents approved
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Loading…</p>
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
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <TrendingUp className="h-4 w-4" />
              Latest Feedback
            </div>
            {latestFeedback ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-gray-900">
                    {latestFeedback.overallRating}/10
                  </p>
                  <Badge variant="secondary">{latestFeedback.sport}</Badge>
                </div>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {latestFeedback.coachNotes || latestFeedback.eventName}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">
                No performance records yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* This week's attendance */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <CalendarCheck className="h-4 w-4" />
              This Week
            </div>
            {thisWeek.length === 0 ? (
              <p className="text-sm text-gray-400">
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
                <span className="ml-1 text-sm text-gray-500">
                  {thisWeek.length} marked
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {quickLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm font-medium text-gray-700 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <l.icon className="h-4 w-4 text-gray-400" />
            {l.label}
          </Link>
        ))}
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
