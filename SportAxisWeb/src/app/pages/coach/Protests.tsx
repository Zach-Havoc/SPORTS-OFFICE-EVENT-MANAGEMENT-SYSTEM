import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useProtests, useFileProtest, useCoachSchedule } from "../../hooks/api";
import type { Protest } from "../../services/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import Loading from "../../components/Loading";
import { RefreshStatus } from "../../components/RefreshStatus";
import { Flag } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<Protest["status"], string> = {
  open: "bg-amber-100 text-amber-700",
  upheld: "bg-emerald-100 text-emerald-700",
  dismissed: "bg-slate-100 text-slate-600",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CoachProtests() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "coach") navigate("/login");
  }, [user, navigate]);

  const protestsQuery = useProtests();
  const scheduleQuery = useCoachSchedule();
  const file = useFileProtest();

  const [eventId, setEventId] = useState("");
  const [reason, setReason] = useState("");

  const protests = protestsQuery.data ?? [];

  // Games the coach's teams have played or are playing — the eligible targets.
  const games = useMemo(
    () =>
      (scheduleQuery.data?.events ?? [])
        .filter((e) => e.status !== "upcoming")
        .sort((a, b) => (a.schedule < b.schedule ? 1 : -1)),
    [scheduleQuery.data],
  );

  const submit = () => {
    if (!eventId) {
      toast.error("Pick the game you are protesting.");
      return;
    }
    if (reason.trim().length < 15) {
      toast.error(
        "Explain the protest in a bit more detail (at least 15 characters).",
      );
      return;
    }
    file.mutate(
      { eventId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("Protest filed. The sports office will review it.");
          setEventId("");
          setReason("");
        },
        onError: (e: any) =>
          toast.error(e?.message || "Could not file the protest"),
      },
    );
  };

  if (protestsQuery.isLoading)
    return <Loading fullScreen={false} message="Loading protests…" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-gray-400" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Protests
          </h1>
          <RefreshStatus
            fetching={protestsQuery.isFetching && !protestsQuery.isLoading}
            error={protestsQuery.isRefetchError}
            onRetry={protestsQuery.refetch}
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Formally contest a game result. The sports office reviews each protest
          and records a written decision.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">File a protest</CardTitle>
          <CardDescription>
            Choose one of your team&rsquo;s games and describe the issue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              {games.length === 0 && (
                <SelectItem value="none" disabled>
                  No played games yet
                </SelectItem>
              )}
              {games.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} · {g.category} ·{" "}
                  {new Date(g.schedule).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What went wrong, and what outcome are you asking for?"
            rows={4}
          />
          <Button onClick={submit} disabled={file.isPending}>
            Submit protest
          </Button>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Your protests
      </h2>
      {protests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-400">
            You have not filed any protests.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {protests.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {p.eventName ?? "Event"}
                    </CardTitle>
                    <CardDescription>{fmt(p.createdAt)}</CardDescription>
                  </div>
                  <Badge
                    className={`text-[11px] capitalize ${STATUS_STYLE[p.status]}`}
                  >
                    {p.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {p.reason}
                </p>
                {p.status !== "open" && p.resolution && (
                  <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Office decision
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {p.resolution}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
