import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  useProtests,
  useFileProtest,
  useProtestableGames,
  useFileProtestCounter,
} from "../../hooks/api";
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
import { Clock, Flag, Reply } from "lucide-react";
import { toast } from "sonner";
import {
  FormLink,
  PdfPicker,
  STATUS_LABEL,
  STATUS_STYLE,
  fmtWhen,
  timeLeft,
} from "../../components/protests/ProtestParts";

/**
 * A coach's appeals (protests), in the office's process:
 *  - file one within 12 hours after a game, with the formal protest form (PDF);
 *  - when the office asks your college for a counter to another team's
 *    protest, file it within 12 hours, with the formal counter form (PDF).
 */
export default function CoachProtests() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "coach") navigate("/login");
  }, [user, navigate]);

  // Deadlines count down without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const protestsQuery = useProtests();
  const gamesQuery = useProtestableGames();
  const file = useFileProtest();

  const [eventId, setEventId] = useState("");
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<File | null>(null);

  const protests = protestsQuery.data ?? [];
  const games = gamesQuery.data ?? [];
  const picked = games.find((g) => g.id === eventId);
  const mine = (user as { department?: string | null } | null)?.department ?? "";

  // Asked of this college by the office, and not answered yet.
  const counterRequests = protests.filter(
    (p) => p.counterDepartment === mine && p.department !== mine && p.status === "awaiting_counter" && !p.counterFiledAt,
  );
  const ours = protests.filter((p) => p.department === mine || !mine);

  const submit = () => {
    if (!eventId) return void toast.error("Pick the game you are appealing.");
    if (reason.trim().length < 15)
      return void toast.error("Explain the appeal in a bit more detail (at least 15 characters).");
    if (!form) return void toast.error("Attach the formal protest form (PDF).");
    file.mutate(
      { eventId, reason: reason.trim(), form },
      {
        onSuccess: () => {
          toast.success("Appeal filed. The sports office will review it.");
          setEventId("");
          setReason("");
          setForm(null);
        },
        onError: (e: any) => toast.error(e?.message || "Could not file the appeal"),
      },
    );
  };

  if (protestsQuery.isLoading) return <Loading fullScreen={false} message="Loading appeals…" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-gray-400" />
          <h1 className="t-page-title">Appeals</h1>
          <RefreshStatus
            fetching={protestsQuery.isFetching && !protestsQuery.isLoading}
            error={protestsQuery.isRefetchError}
            onRetry={protestsQuery.refetch}
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Formally contest a game result within 12 hours after the game, with the formal protest form. The
          sports office may ask the other team for a counter, then records a written decision.
        </p>
      </div>

      {counterRequests.length > 0 && (
        <section className="mb-6 space-y-4" aria-labelledby="counters">
          <h2 id="counters" className="text-sm font-semibold uppercase tracking-wide text-sky-800">
            Counter requested from your college
          </h2>
          {counterRequests.map((p) => (
            <CounterRequest key={p.id} protest={p} now={now} />
          ))}
        </section>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">File an appeal</CardTitle>
          <CardDescription>
            Choose one of your team&rsquo;s games from the last 12 hours, describe the issue, and attach the
            formal protest form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="max-w-xl" aria-label="Game">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              {games.length === 0 && (
                <SelectItem value="none" disabled>
                  No game inside its 12-hour window
                </SelectItem>
              )}
              {games.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} · closes {fmtWhen(g.deadline)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {picked && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <Clock className="h-3.5 w-3.5" />
              The window for this game closes {fmtWhen(picked.deadline)} ({timeLeft(picked.deadline, now)}).
            </p>
          )}
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What went wrong, and what outcome are you asking for?"
            rows={4}
          />
          <PdfPicker
            file={form}
            onChange={setForm}
            onError={(m) => toast.error(m)}
            label="Attach the formal protest form (PDF)"
          />
          <Button onClick={submit} disabled={file.isPending}>
            {file.isPending ? "Submitting…" : "Submit appeal"}
          </Button>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Your college&rsquo;s appeals</h2>
      {ours.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-400">You have not filed any appeals.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ours.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.eventName ?? "Event"}</CardTitle>
                    <CardDescription>Filed {fmtWhen(p.createdAt)}</CardDescription>
                  </div>
                  <Badge className={`text-[11px] ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap text-sm text-gray-700">{p.reason}</p>
                <FormLink url={p.formUrl} label="Your protest form" />

                {p.counterRequestedAt && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                    {p.counterFiledAt ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {p.counterDepartment}&rsquo;s counter · {fmtWhen(p.counterFiledAt)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-gray-700">{p.counterReason}</p>
                        <div className="mt-2">
                          <FormLink url={p.counterFormUrl} label="Counter form" />
                        </div>
                      </>
                    ) : p.counterLapsed ? (
                      <p className="text-gray-600">
                        {p.counterDepartment} was asked for a counter but did not file one in time.
                      </p>
                    ) : (
                      <p className="text-gray-600">
                        The office asked {p.counterDepartment} for a counter, due {fmtWhen(p.counterDueAt)}.
                      </p>
                    )}
                  </div>
                )}

                {(p.status === "upheld" || p.status === "dismissed") && p.resolution && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Office decision</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{p.resolution}</p>
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

/** Another team's protest that the office wants this college to answer. */
function CounterRequest({ protest: p, now }: { protest: Protest; now: number }) {
  const counter = useFileProtestCounter();
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<File | null>(null);
  const closed = p.counterLapsed || timeLeft(p.counterDueAt, now) === "closed";

  const submit = () => {
    if (reason.trim().length < 15) return void toast.error("Explain your counter (at least 15 characters).");
    if (!form) return void toast.error("Attach the formal counter form (PDF).");
    counter.mutate(
      { id: p.id, data: { reason: reason.trim(), form } },
      {
        onSuccess: () => toast.success("Counter filed. The sports office will decide."),
        onError: (e: any) => toast.error(e?.message || "Could not file the counter"),
      },
    );
  };

  return (
    <Card className="border-sky-200">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{p.eventName ?? "Event"}</CardTitle>
            <CardDescription>
              {p.department} protested this game · {fmtWhen(p.createdAt)}
            </CardDescription>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
              closed ? "bg-gray-100 text-gray-600" : "bg-sky-100 text-sky-800"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {closed ? "Window closed" : `Due ${fmtWhen(p.counterDueAt)} · ${timeLeft(p.counterDueAt, now)}`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Their protest</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{p.reason}</p>
          <div className="mt-2">
            <FormLink url={p.formUrl} label="Their protest form" />
          </div>
        </div>
        {closed ? (
          <p className="text-sm text-gray-500">The 12-hour counter window has closed. The office will decide without it.</p>
        ) : (
          <>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Your side: why the result should stand, or what really happened."
              rows={3}
            />
            <PdfPicker
              file={form}
              onChange={setForm}
              onError={(m) => toast.error(m)}
              label="Attach the formal counter form (PDF)"
            />
            <Button onClick={submit} disabled={counter.isPending}>
              <Reply className="mr-1.5 h-4 w-4" />
              {counter.isPending ? "Submitting…" : "Submit counter"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
