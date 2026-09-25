import { useEffect } from "react";
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
import { Users, Mail, Megaphone } from "lucide-react";
import { useMyTeam } from "../../hooks/api";
import { RefreshStatus } from "../../components/RefreshStatus";
import Loading from "../../components/Loading";

function fmt(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AthleteTeam() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "athlete") navigate("/login");
  }, [user, navigate]);

  const query = useMyTeam();
  const team = query.data;
  const loading = query.isLoading;

  if (!user) return null;
  if (loading)
    return <Loading fullScreen={false} message="Loading your team…" />;

  if (!team?.coach) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">You are not enrolled with a coach yet.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="t-page-title">
          My Team
        </h1>
        <RefreshStatus
          fetching={query.isFetching && !loading}
          error={query.isRefetchError}
          onRetry={() => query.refetch()}
        />
      </div>

      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 py-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {initials(team.coach.name)}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{team.coach.name}</p>
            <p className="text-sm text-gray-500">
              {team.coach.sport} · Head Coach
            </p>
            <a
              href={`mailto:${team.coach.email}`}
              className="mt-1 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Mail className="h-3.5 w-3.5" />
              {team.coach.email}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            Teammates ({team.teammates.length})
          </CardTitle>
          <CardDescription>Other athletes on your roster.</CardDescription>
        </CardHeader>
        <CardContent>
          {team.teammates.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No other teammates yet.
            </p>
          ) : (
            <ul className="divide-y">
              {team.teammates.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                    {initials(t.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {t.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {[t.department, t.yearLevel].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-gray-400" />
            Announcements
          </CardTitle>
          <CardDescription>From {team.coach.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          {team.announcements.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No announcements yet.
            </p>
          ) : (
            <div className="space-y-4">
              {team.announcements.map((a) => (
                <div key={a.id} className="rounded-lg border p-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">{a.title}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.isTryout && <Badge variant="neutral">Tryout</Badge>}
                      <span className="text-xs text-gray-400">
                        {fmt(a.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-gray-600">
                    {a.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
