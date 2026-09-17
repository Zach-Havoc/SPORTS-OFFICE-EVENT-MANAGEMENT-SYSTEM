import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  getEvents,
  getEventReport,
  getEventScores,
  exportEventReport,
  exportLeaderboard,
  exportCertificates,
  deliverExport,
  verifyScore,
  disputeScore,
  officializeEvent,
} from "../../services/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  FileDown,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  ScanLine,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import Loading from "../../components/Loading";

interface Event {
  id: string;
  name: string;
  status: string;
}

interface ScoreRow {
  id: string;
  department: string;
  judgeName: string;
  totalScore: number;
  status: "verified" | "disputed" | "official";
  disputeReason: string | null;
  method: "manual" | "ocr";
  imageUrl: string | null;
  scores: Record<string, any>;
}

const SCORE_STYLE: Record<ScoreRow["status"], string> = {
  verified: "bg-emerald-100 text-emerald-700",
  disputed: "bg-red-100 text-red-700",
  official: "bg-blue-100 text-blue-700",
};

export default function AdminReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [report, setReport] = useState<any>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [sheetScore, setSheetScore] = useState<ScoreRow | null>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const data = await getEvents();
        setEvents(
          data.filter(
            (e: Event) => e.status === "completed" || e.status === "ongoing",
          ),
        );
      } catch {
        toast.error("Failed to load events");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, navigate]);

  const load = useCallback(async (eventId: string) => {
    if (!eventId) return;
    try {
      const [rep, sc] = await Promise.all([
        getEventReport(eventId),
        getEventScores(eventId),
      ]);
      setReport(rep);
      setScores(sc as ScoreRow[]);
    } catch {
      toast.error("Failed to load the event result");
    }
  }, []);

  const onSelect = (v: string) => {
    setSelectedEvent(v);
    setReport(null);
    setScores([]);
    load(v);
  };

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      await load(selectedEvent);
      toast.success("Done");
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy("");
    }
  };

  const onDispute = (s: ScoreRow) => {
    const reason = window.prompt(
      `Why is ${s.department}'s score (${s.totalScore}) disputed?`,
    );
    if (reason && reason.trim().length >= 5) {
      act(`dispute-${s.id}`, () => disputeScore(s.id, reason.trim()));
    } else if (reason !== null) {
      toast.error("Give a short reason (at least 5 characters).");
    }
  };

  const runExport = async (
    fn: () => Promise<{ blob: Blob; filename: string }>,
  ) => {
    try {
      deliverExport(await fn());
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Loading fullScreen={false} message="Loading reports..." />
      </div>
    );
  }

  const hasVerified = scores.some((s) => s.status === "verified");
  const allOfficial =
    scores.length > 0 && scores.every((s) => s.status === "official");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Reports &amp; Results
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review an event&rsquo;s scores, set aside anything disputed, lock in
          the official result, and export the report.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Season exports</CardTitle>
          <CardDescription>
            Official standings and certificates for the active season.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => runExport(() => exportLeaderboard("html"))}
            >
              <FileText className="mr-2 h-4 w-4" />
              Standings (print / PDF)
            </Button>
            <Button
              variant="outline"
              onClick={() => runExport(() => exportLeaderboard("csv"))}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Standings (CSV)
            </Button>
            <Button
              variant="outline"
              onClick={() => runExport(() => exportCertificates())}
            >
              <FileText className="mr-2 h-4 w-4" />
              Champion certificates
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Event result</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedEvent} onValueChange={onSelect}>
              <SelectTrigger className="min-w-[240px] flex-1">
                <SelectValue placeholder="Choose an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() =>
                runExport(() => exportEventReport(selectedEvent, "html"))
              }
              disabled={!selectedEvent}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
            <Button
              onClick={() =>
                runExport(() => exportEventReport(selectedEvent, "csv"))
              }
              disabled={!selectedEvent}
              variant="outline"
            >
              <FileText className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Score review</CardTitle>
                <CardDescription>
                  Only verified and official scores count on the leaderboard.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!hasVerified || allOfficial || busy === "officialize"}
                onClick={() =>
                  act("officialize", () => officializeEvent(selectedEvent))
                }
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                {allOfficial ? "Result is official" : "Mark official"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scores.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                No scores submitted yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {scores.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {s.department}
                        <span className="ml-2 font-normal text-gray-400">
                          by {s.judgeName}
                        </span>
                      </p>
                      {s.status === "disputed" && s.disputeReason && (
                        <p className="mt-0.5 text-xs text-red-600">
                          {s.disputeReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-gray-700">
                        {s.totalScore}
                      </span>
                      <Badge
                        className={`text-[11px] capitalize ${SCORE_STYLE[s.status]}`}
                      >
                        {s.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSheetScore(s)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View Score Sheet
                      </Button>
                      {s.status === "disputed" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === `verify-${s.id}`}
                          onClick={() =>
                            act(`verify-${s.id}`, () => verifyScore(s.id))
                          }
                        >
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          Verify
                        </Button>
                      ) : (
                        s.status !== "official" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDispute(s)}
                          >
                            <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                            Dispute
                          </Button>
                        )
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {report && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Report summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>Event: {report.eventName}</p>
                <p>
                  Date:{" "}
                  {report.date
                    ? new Date(report.date).toLocaleDateString()
                    : "—"}
                </p>
                <p>Participants: {report.participants}</p>
              </div>
              {report.rankings && report.rankings.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2">Rank</th>
                        <th className="py-2">College</th>
                        <th className="py-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rankings.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2">{r.rank}</td>
                          <td className="py-2">{r.department}</td>
                          <td className="py-2 text-right font-semibold">
                            {r.score}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!sheetScore}
        onOpenChange={(o) => !o && setSheetScore(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Score sheet — {sheetScore?.department}</DialogTitle>
            <DialogDescription>
              Judged by {sheetScore?.judgeName}
            </DialogDescription>
          </DialogHeader>

          {sheetScore && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={`text-[11px] capitalize ${SCORE_STYLE[sheetScore.status]}`}
                >
                  {sheetScore.status}
                </Badge>
                <Badge
                  className={`text-[11px] ${
                    sheetScore.method === "ocr"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {sheetScore.method === "ocr" ? (
                    <ScanLine className="mr-1 h-3 w-3" />
                  ) : (
                    <PenLine className="mr-1 h-3 w-3" />
                  )}
                  {sheetScore.method === "ocr" ? "OCR" : "Manual entry"}
                </Badge>
                <span className="ml-auto text-lg font-semibold tabular-nums text-gray-900">
                  {sheetScore.totalScore}
                </span>
              </div>

              {sheetScore.status === "disputed" && sheetScore.disputeReason && (
                <p className="text-sm text-red-600">
                  {sheetScore.disputeReason}
                </p>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Criteria breakdown
                </p>
                {sheetScore.scores &&
                Object.keys(sheetScore.scores).length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {Object.entries(sheetScore.scores)
                      .filter(
                        ([, value]) =>
                          value !== undefined &&
                          value !== null &&
                          value !== "",
                      )
                      .map(([key, value]) => (
                        <div key={key} className="rounded bg-gray-50 p-2">
                          <p className="text-xs capitalize text-gray-600">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-lg font-semibold">
                            {String(value)}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No criteria breakdown was recorded for this score.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Photographed score sheet
                </p>
                {sheetScore.imageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={sheetScore.imageUrl}
                      alt={`Score sheet for ${sheetScore.department}`}
                      className="max-h-80 w-full rounded-lg border object-contain"
                    />
                    <a
                      href={sheetScore.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Open full-size in new tab
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No photo attached — this score was entered directly in
                    the app.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
