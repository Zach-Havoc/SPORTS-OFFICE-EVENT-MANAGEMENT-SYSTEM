import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertCircle,
} from "lucide-react";
import { useAttendanceRecords } from "../../hooks/api";
import { RefreshStatus } from "../../components/RefreshStatus";
import Loading from "../../components/Loading";

interface AttendanceRow {
  id: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  notes: string | null;
  sessionTitle: string | null;
}

const STATUS: Record<
  AttendanceRow["status"],
  { label: string; className: string; dot: string; icon: typeof CheckCircle2 }
> = {
  present: {
    label: "Present",
    className: "border-green-300 bg-green-100 text-green-800",
    dot: "bg-green-500",
    icon: CheckCircle2,
  },
  late: {
    label: "Late",
    className: "border-amber-300 bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    icon: Clock3,
  },
  excused: {
    label: "Excused",
    className: "border-blue-300 bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
    icon: AlertCircle,
  },
  absent: {
    label: "Absent",
    className: "border-red-300 bg-red-100 text-red-800",
    dot: "bg-red-500",
    icon: XCircle,
  },
};

function fmt(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AthleteAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "athlete") navigate("/login");
  }, [user, navigate]);

  const query = useAttendanceRecords();
  const records: AttendanceRow[] = query.data ?? [];
  const loading = query.isLoading;

  const rate = useMemo(() => {
    if (!records.length) return null;
    const present = records.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    return Math.round((present / records.length) * 100);
  }, [records]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, excused: 0, absent: 0 };
    for (const r of records) c[r.status]++;
    return c;
  }, [records]);

  if (!user) return null;
  if (loading)
    return <Loading fullScreen={false} message="Loading attendance…" />;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          My Attendance
        </h1>
        <RefreshStatus
          fetching={query.isFetching && !loading}
          error={query.isRefetchError}
          onRetry={() => query.refetch()}
        />
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-6 py-5">
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {rate == null ? "—" : `${rate}%`}
            </p>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Attendance rate
            </p>
          </div>
          <div className="flex flex-1 flex-wrap gap-4 text-sm">
            {(Object.keys(STATUS) as AttendanceRow["status"][]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${STATUS[s].dot}`} />
                <span className="text-gray-600">{STATUS[s].label}</span>
                <span className="font-semibold text-gray-900">{counts[s]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Every mark your coach has recorded, most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarCheck className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No attendance recorded yet</p>
            </div>
          ) : (
            <ul className="divide-y">
              {records.map((r) => {
                const s = STATUS[r.status];
                const Icon = s.icon;
                return (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {r.sessionTitle ?? "Training"}
                      </p>
                      <p className="text-sm text-gray-500">{fmt(r.date)}</p>
                      {r.notes && (
                        <p className="mt-1 text-sm text-gray-600">{r.notes}</p>
                      )}
                    </div>
                    <Badge className={`shrink-0 ${s.className}`}>
                      <Icon className="mr-1 h-3 w-3" />
                      {s.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
