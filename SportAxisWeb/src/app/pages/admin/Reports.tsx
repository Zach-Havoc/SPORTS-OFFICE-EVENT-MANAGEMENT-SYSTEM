import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  getEvents,
  getEventReport,
  getEventScores,
  exportEventReport,
  exportResults,
  exportLeaderboard,
  exportCertificates,
  deliverExport,
  openPrintable,
  verifyScore,
  disputeScore,
  officializeEvent,
  unwrapList,
  getPageMeta,
  type EventReport,
  type ReportMatch,
  type ReportScorer,
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
import { Input } from "../../components/ui/input";
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
  Printer,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  ScanLine,
  PenLine,
  Search,
  Trophy,
  ListOrdered,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import Loading from "../../components/Loading";

interface Event {
  id: string;
  name: string;
  status: string;
  category?: string;
  schedule?: string | null;
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

const MATCH_STATE: Record<ReportMatch["state"], { label: string; style: string }> = {
  final: { label: "Final", style: "bg-emerald-100 text-emerald-700" },
  forfeit: { label: "Forfeit", style: "bg-amber-100 text-amber-800" },
  live: { label: "In progress", style: "bg-red-100 text-red-700" },
  scheduled: { label: "Not played", style: "bg-gray-100 text-gray-600" },
};

const ALL_SPORTS = "__all";

// /events may return a bare array or a Laravel paginator; this walks every
// page either way so a season with more than one page of events doesn't
// silently lose entries from this report's event picker.
async function fetchAllReportEvents(): Promise<Event[]> {
  const first = await getEvents(undefined, { page: 1, perPage: 200 });
  if (Array.isArray(first)) return first;

  const meta = getPageMeta<Event>(first);
  let items = unwrapList<Event>(first);
  if (!meta || meta.lastPage <= meta.currentPage) return items;

  const rest = await Promise.all(
    Array.from({ length: meta.lastPage - meta.currentPage }, (_, i) =>
      getEvents(undefined, { page: meta.currentPage + i + 1, perPage: 200 }),
    ),
  );
  for (const page of rest) items = items.concat(unwrapList<Event>(page));
  return items;
}

function formatDate(date?: string | null, withYear = true) {
  if (!date) return "No date";
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export default function AdminReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [report, setReport] = useState<EventReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [sheetScore, setSheetScore] = useState<ScoreRow | null>(null);
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState(ALL_SPORTS);
  const [resultsSport, setResultsSport] = useState(ALL_SPORTS);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const data = await fetchAllReportEvents();
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

  const sports = useMemo(
    () =>
      Array.from(
        new Set(events.map((e) => e.category).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [events],
  );

  // Newest first: the office usually reports on what just finished.
  const visibleEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => sport === ALL_SPORTS || e.category === sport)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          (e.category ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (b.schedule ?? "").localeCompare(a.schedule ?? ""));
  }, [events, query, sport]);

  const load = useCallback(async (eventId: string) => {
    if (!eventId) return;
    setReportLoading(true);
    try {
      const [rep, sc] = await Promise.all([
        getEventReport(eventId),
        getEventScores(eventId),
      ]);
      setReport(rep);
      setScores(sc as ScoreRow[]);
    } catch {
      toast.error("Failed to load the event result");
    } finally {
      setReportLoading(false);
    }
  }, []);

  const onSelect = (id: string) => {
    setSelectedEvent(id);
    setReport(null);
    setScores([]);
    load(id);
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

  const download = async (
    label: string,
    fn: () => Promise<{ blob: Blob; filename: string }>,
  ) => {
    setBusy(label);
    try {
      deliverExport(await fn());
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setBusy("");
    }
  };

  // Not awaited before opening: openPrintable opens the tab inside the click.
  const print = (
    label: string,
    fn: () => Promise<{ blob: Blob; filename: string }>,
  ) => {
    setBusy(label);
    openPrintable(fn)
      .catch((e: any) => toast.error(e?.message || "Could not open the report"))
      .finally(() => setBusy(""));
  };

  if (loading) {
    return (
      <div className="page-container py-8">
        <Loading fullScreen={false} message="Loading reports..." />
      </div>
    );
  }

  const hasVerified = scores.some((s) => s.status === "verified");
  const allOfficial =
    scores.length > 0 && scores.every((s) => s.status === "official");
  const resultsOpts = {
    sport: resultsSport === ALL_SPORTS ? undefined : resultsSport,
  };

  return (
    <div className="page-container py-8">
      <div className="mb-6">
        <h1 className="t-page-title">Reports &amp; Results</h1>
        <p className="t-page-lede mt-1">
          Print or download official results. Season documents cover the
          active season; pick an event below for its own result sheet.
        </p>
      </div>

      <section aria-labelledby="season-docs" className="mb-8">
        <h2 id="season-docs" className="t-section mb-3">
          Season documents
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-gray-400" />
                College standings
              </CardTitle>
              <CardDescription>
                Rank, points and medal tally for every college.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy === "standings-print"}
                onClick={() =>
                  print("standings-print", () => exportLeaderboard("html"))
                }
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print / PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === "standings-csv"}
                onClick={() =>
                  download("standings-csv", () => exportLeaderboard("csv"))
                }
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListOrdered className="h-4 w-4 text-gray-400" />
                All results
              </CardTitle>
              <CardDescription>
                Every finished match and judged event, grouped by sport.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={resultsSport} onValueChange={setResultsSport}>
                <SelectTrigger className="h-8 w-full text-sm" aria-label="Sport for the results report">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SPORTS}>All sports</SelectItem>
                  {sports.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === "results-print"}
                  onClick={() =>
                    print("results-print", () =>
                      exportResults("html", resultsOpts),
                    )
                  }
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print / PDF
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === "results-csv"}
                  onClick={() =>
                    download("results-csv", () =>
                      exportResults("csv", resultsOpts),
                    )
                  }
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4 text-gray-400" />
                Certificates
              </CardTitle>
              <CardDescription>
                One page per medaling college, champion first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                disabled={busy === "certs-print"}
                onClick={() => print("certs-print", () => exportCertificates())}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print / PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="event-reports">
        <h2 id="event-reports" className="t-section mb-3">
          Event result sheet
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <Card className="self-start">
            <CardContent className="space-y-3 pt-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events or colleges"
                  aria-label="Search events"
                  className="pl-8"
                />
              </div>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="w-full" aria-label="Filter by sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SPORTS}>All sports</SelectItem>
                  {sports.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="t-meta">
                {visibleEvents.length} of {events.length} finished or ongoing
                events
              </p>
              {visibleEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  {events.length === 0
                    ? "No event has finished yet."
                    : "No event matches that search."}
                </p>
              ) : (
                <ul
                  className="-mx-2 max-h-[28rem] overflow-y-auto lg:max-h-[36rem]"
                  aria-label="Events"
                >
                  {visibleEvents.map((e) => {
                    const active = e.id === selectedEvent;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(e.id)}
                          aria-current={active ? "true" : undefined}
                          className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                            active ? "bg-gray-100" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className="line-clamp-2 text-sm font-medium text-gray-900">
                            {e.name}
                          </span>
                          <span className="t-meta mt-0.5 flex items-center gap-2">
                            {formatDate(e.schedule)}
                            {e.status === "ongoing" && (
                              <span className="rounded bg-red-50 px-1.5 text-[11px] font-medium text-red-700">
                                Ongoing
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            {!selectedEvent ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <p className="t-subsection">Pick an event</p>
                  <p className="t-supporting mx-auto mt-1">
                    Its result sheet shows here, ready to print or download.
                  </p>
                </CardContent>
              </Card>
            ) : reportLoading && !report ? (
              <Card>
                <CardContent className="py-12">
                  <Loading fullScreen={false} message="Loading the result..." />
                </CardContent>
              </Card>
            ) : report ? (
              <>
                <ReportHeader
                  report={report}
                  busy={busy}
                  onPrint={() =>
                    print("event-print", () =>
                      exportEventReport(selectedEvent, "html"),
                    )
                  }
                  onCsv={() =>
                    download("event-csv", () =>
                      exportEventReport(selectedEvent, "csv"),
                    )
                  }
                />

                {report.match ? (
                  <MatchResult match={report.match} />
                ) : (
                  report.event.format === "versus" &&
                  report.rankings.length === 0 && (
                    <Card>
                      <CardContent className="py-8 text-center text-sm text-gray-500">
                        No result has been recorded for this match yet. It
                        appears here once the committee finishes scoring it.
                      </CardContent>
                    </Card>
                  )
                )}

                {report.rankings.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Final standing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                              <th className="py-2 pr-3">Rank</th>
                              <th className="py-2 pr-3">College</th>
                              <th className="py-2 pr-3">Medal</th>
                              <th className="py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.rankings.map((r) => (
                              <tr key={r.rank + r.department} className="border-b border-gray-50">
                                <td className="py-2 pr-3 tabular-nums">{r.rank}</td>
                                <td className="py-2 pr-3">{r.department}</td>
                                <td className="py-2 pr-3 text-gray-500">{r.medal ?? "—"}</td>
                                <td className="py-2 text-right font-semibold tabular-nums">
                                  {r.total}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(scores.length > 0 || report.event.format === "ranked") && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            Judges&rsquo; scores
                          </CardTitle>
                          <CardDescription>
                            Only verified and official scores count toward the
                            ranking.
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={
                            !hasVerified || allOfficial || busy === "officialize"
                          }
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
                              <div className="flex flex-wrap items-center gap-2">
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
                                  Score sheet
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

                {report.protests.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Protests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y divide-gray-100">
                        {report.protests.map((p, i) => (
                          <li key={i} className="py-2.5 text-sm">
                            <p className="font-medium text-gray-900">
                              {p.department}
                              <Badge className="ml-2 bg-gray-100 text-[11px] capitalize text-gray-700">
                                {p.status}
                              </Badge>
                            </p>
                            <p className="mt-0.5 text-gray-600">{p.reason}</p>
                            {p.resolution && (
                              <p className="mt-0.5 text-gray-500">
                                Resolution: {p.resolution}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </div>
        </div>
      </section>

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
                    No score breakdown was recorded for this score.
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
                      loading="lazy"
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

function ReportHeader({
  report,
  busy,
  onPrint,
  onCsv,
}: {
  report: EventReport;
  busy: string;
  onPrint: () => void;
  onCsv: () => void;
}) {
  const e = report.event;
  const time = [e.startTime, e.endTime].filter(Boolean).join("–");
  const facts: [string, string | null | undefined][] = [
    ["Sport", e.category],
    ["Stage", report.match?.stage],
    ["Date", `${formatDate(e.schedule)}${time ? ` · ${time}` : ""}`],
    ["Venue", e.venue],
    ["Season", e.season],
    ["Recorded by", report.match?.recordedBy],
    ["Officials", e.officials.length ? e.officials.join(", ") : null],
  ];

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-overline">Result sheet</p>
            <h3 className="t-section mt-0.5 break-words">{e.name}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onPrint} disabled={busy === "event-print"}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print / PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onCsv}
              disabled={busy === "event-csv"}
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex min-w-0 gap-2">
                <dt className="w-24 flex-none text-gray-500">{k}</dt>
                <dd className="min-w-0 break-words font-medium text-gray-900">
                  {v}
                </dd>
              </div>
            ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function MatchResult({ match: m }: { match: ReportMatch }) {
  const state = MATCH_STATE[m.state];
  const homeWon = m.winner !== null && m.winner === m.home;
  const awayWon = m.winner !== null && m.winner === m.away;
  const scorers = Array.isArray(m.scorers) ? {} : m.scorers;
  const hasScorers = !!(scorers.home?.length || scorers.away?.length);

  const verdict =
    m.state === "live"
      ? "In progress — this score is not final yet."
      : m.state === "scheduled"
        ? "This match has not been played."
        : m.isDraw
          ? "The match ended in a draw."
          : `${m.winner} won${m.state === "forfeit" ? " by forfeit" : ""}.`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Result</CardTitle>
          <Badge className={`text-[11px] ${state.style}`}>{state.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-gray-200 px-4 py-4">
          <TeamName name={m.home} won={homeWon} lost={awayWon} />
          <p className="numeral whitespace-nowrap text-3xl text-gray-900">
            {m.homeScore}
            <span className="mx-2 text-gray-300">–</span>
            {m.awayScore}
          </p>
          <TeamName name={m.away} won={awayWon} lost={homeWon} alignEnd />
        </div>
        <p className="text-sm text-gray-600">{verdict}</p>

        {m.periods.length > 0 && (
          <div>
            <p className="t-overline mb-2">
              Score by {(m.periodUnit ?? "period").toLowerCase()}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3 text-left">College</th>
                    {m.periods.map((p) => (
                      <th key={p.label} className="whitespace-nowrap px-2 py-2 text-center">
                        {p.label}
                      </th>
                    ))}
                    <th className="py-2 pl-2 text-center">Final</th>
                  </tr>
                </thead>
                <tbody>
                  {(["home", "away"] as const).map((side) => (
                    <tr
                      key={side}
                      className={`border-b border-gray-50 ${m.winner === m[side] ? "font-semibold text-gray-900" : "text-gray-700"}`}
                    >
                      <td className="max-w-[14rem] truncate py-2 pr-3" title={m[side]}>
                        {m[side]}
                      </td>
                      {m.periods.map((p) => (
                        <td key={p.label} className="px-2 py-2 text-center tabular-nums">
                          {p[side]}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-center tabular-nums">
                        {side === "home" ? m.homeScore : m.awayScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasScorers && (
          <div>
            <p className="t-overline mb-2">Leading scorers</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["home", "away"] as const).map((side) => (
                <ScorerList
                  key={side}
                  team={m[side]}
                  players={scorers[side] ?? []}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamName({
  name,
  won,
  lost,
  alignEnd,
}: {
  name: string;
  won: boolean;
  lost: boolean;
  alignEnd?: boolean;
}) {
  return (
    <div className={`min-w-0 ${alignEnd ? "text-right" : ""}`}>
      <p
        className={`text-sm leading-snug ${lost ? "text-gray-500" : "font-semibold text-gray-900"}`}
      >
        {name}
      </p>
      {won && (
        <span className="mt-1 inline-block rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Winner
        </span>
      )}
    </div>
  );
}

function ScorerList({ team, players }: { team: string; players: ReportScorer[] }) {
  return (
    <div className="min-w-0">
      <p className="t-label mb-1 truncate" title={team}>
        {team}
      </p>
      {players.length === 0 ? (
        <p className="text-sm text-gray-400">No points credited to a player.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {players.map((p) => (
            <li key={`${p.jersey}-${p.name}`} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">
                <span className="mr-1.5 tabular-nums text-gray-400">#{p.jersey ?? "–"}</span>
                {p.name}
              </span>
              <span className="font-semibold tabular-nums">{p.points}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
