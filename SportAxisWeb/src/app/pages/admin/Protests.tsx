import { useCallback, useEffect, useState, memo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useProtests, useRequestProtestCounter, useResolveProtest } from "../../hooks/api";
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
import { Gavel, CheckCircle2, XCircle, Clock, Reply } from "lucide-react";
import { toast } from "sonner";
import { FormError, errorText } from "../../components/ui/form-error";
import {
  FormLink,
  STATUS_LABEL,
  STATUS_STYLE,
  fmtWhen as fmt,
  timeLeft,
} from "../../components/protests/ProtestParts";

export default function AdminProtests() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/login");
  }, [user, navigate]);

  const [status, setStatus] = useState("all");
  const query = useProtests(status === "all" ? {} : { status });
  const resolve = useResolveProtest();
  const askCounter = useRequestProtestCounter();

  // Deadlines count down without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const protests = query.data ?? [];
  // Why an action on an appeal failed, by appeal, shown in its card.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setErrorFor = useCallback(
    (id: string, message: string) => setErrors((prev) => ({ ...prev, [id]: message })),
    [],
  );

  const requestCounter = useCallback(
    (p: Protest, department?: string) => {
      setErrorFor(p.id, "");
      askCounter.mutate(
        { id: p.id, department },
        {
          onSuccess: (r) => toast.success(`Asked ${r.counterDepartment} for a counter. They have 12 hours.`),
          onError: (e: any) => setErrorFor(p.id, errorText(e, "Could not ask for a counter")),
        },
      );
    },
    [askCounter, setErrorFor],
  );

  // Stable across renders so a keystroke in one card's resolution textarea
  // doesn't re-render every other (memoized) card in the list.
  const submit = useCallback(
    (p: Protest, decision: "upheld" | "dismissed", resolution: string, onDone: () => void) => {
      setErrorFor(p.id, "");
      if (resolution.trim().length < 10) {
        setErrorFor(p.id, "Write a short resolution note (at least 10 characters).");
        return;
      }
      resolve.mutate(
        { id: p.id, data: { status: decision, resolution: resolution.trim() } },
        {
          onSuccess: () => {
            toast.success(`Appeal ${decision}`);
            onDone();
          },
          onError: (e: any) => setErrorFor(p.id, errorText(e, "Could not resolve")),
        },
      );
    },
    [resolve, setErrorFor],
  );

  if (query.isLoading)
    return <Loading fullScreen={false} message="Loading appeals…" />;

  return (
    <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-gray-400" />
          <h1 className="t-page-title">
            Appeals
          </h1>
          <RefreshStatus
            fetching={query.isFetching && !query.isLoading}
            error={query.isRefetchError}
            onRetry={query.refetch}
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Protests filed by coaches within 12 hours after a game, each with its
          formal form. Ask the other team for a counter (they have 12 hours),
          or decide straight away; the coaches see your written decision.
        </p>
      </div>

      <div className="mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All appeals</SelectItem>
            <SelectItem value="open">Under review</SelectItem>
            <SelectItem value="awaiting_counter">Waiting for counter</SelectItem>
            <SelectItem value="upheld">Upheld</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {protests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            No appeals.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {protests.map((p) => (
            <ProtestCard
              key={p.id}
              protest={p}
              now={now}
              onSubmit={submit}
              onRequestCounter={requestCounter}
              submitting={resolve.isPending}
              requesting={askCounter.isPending}
              error={errors[p.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Each card owns its own "reviewing" draft state (decision + resolution
// text), instead of that living in the parent keyed by id. Typing in one
// card's textarea used to re-render every protest card on every keystroke;
// now, wrapped in React.memo, only the card being edited re-renders.
const ProtestCard = memo(function ProtestCard({
  protest: p,
  now,
  onSubmit,
  onRequestCounter,
  submitting,
  requesting,
  error,
}: {
  protest: Protest;
  error?: string;
  now: number;
  onSubmit: (
    p: Protest,
    decision: "upheld" | "dismissed",
    resolution: string,
    onDone: () => void,
  ) => void;
  onRequestCounter: (p: Protest, department?: string) => void;
  submitting: boolean;
  requesting: boolean;
}) {
  // The game's other colleges: who can be asked for a counter.
  const others = (p.eventDepartments ?? []).filter((d) => d && d !== p.department);
  const [counterFrom, setCounterFrom] = useState(others.length === 1 ? others[0] : "");
  const decided = p.status === "upheld" || p.status === "dismissed";
  const counterDue = p.status === "awaiting_counter" && !p.counterLapsed && timeLeft(p.counterDueAt, now) !== "closed";
  const canAskCounter = p.status === "open" && !p.counterRequestedAt && others.length > 0;
  const [reviewing, setReviewing] = useState(false);
  const [decision, setDecision] = useState<"upheld" | "dismissed">("upheld");
  const [resolution, setResolution] = useState("");

  const startReview = useCallback(() => {
    setReviewing(true);
    setDecision("upheld");
    setResolution("");
  }, []);

  const save = useCallback(() => {
    onSubmit(p, decision, resolution, () => {
      setReviewing(false);
      setResolution("");
    });
  }, [onSubmit, p, decision, resolution]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {p.eventName ?? "Event"}{" "}
              <span className="font-normal text-gray-400">
                · {p.eventCategory}
              </span>
            </CardTitle>
            <CardDescription>
              {p.department} · filed by {p.filerName ?? "—"} ·{" "}
              {fmt(p.createdAt)}
            </CardDescription>
          </div>
          <Badge className={`text-[11px] ${STATUS_STYLE[p.status]}`}>
            {STATUS_LABEL[p.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {p.reason}
        </p>
        <div className="mt-2">
          <FormLink url={p.formUrl} label="Protest form" />
        </div>

        {p.counterRequestedAt && (
          <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/50 p-3 text-sm">
            {p.counterFiledAt ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">
                  Counter · {p.counterDepartment} · {p.counterFilerName ?? "—"} · {fmt(p.counterFiledAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-gray-700">{p.counterReason}</p>
                <div className="mt-2">
                  <FormLink url={p.counterFormUrl} label="Counter form" />
                </div>
              </>
            ) : counterDue ? (
              <p className="flex items-center gap-1.5 font-medium text-sky-900">
                <Clock className="h-4 w-4" />
                Waiting for {p.counterDepartment}&rsquo;s counter · due {fmt(p.counterDueAt)} ({timeLeft(p.counterDueAt, now)})
              </p>
            ) : (
              <p className="text-gray-600">
                {p.counterDepartment} was asked for a counter on {fmt(p.counterRequestedAt)} and did not file one within 12 hours.
              </p>
            )}
          </div>
        )}

        {decided && p.resolution && (
          <div className="mt-3 rounded-lg border border-gray-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Resolution · {p.resolverName ?? "—"}
              {p.resolvedAt ? ` · ${fmt(p.resolvedAt)}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
              {p.resolution}
            </p>
          </div>
        )}

        {canAskCounter && !reviewing && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {others.length > 1 && (
              <Select value={counterFrom} onValueChange={setCounterFrom}>
                <SelectTrigger className="h-9 w-56 text-sm" aria-label="College to ask for a counter">
                  <SelectValue placeholder="Ask which college?" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={requesting || !counterFrom}
              onClick={() => onRequestCounter(p, counterFrom || undefined)}
            >
              <Reply className="mr-1.5 h-3.5 w-3.5" />
              Ask {others.length === 1 ? others[0] : "the other team"} for a counter (12h)
            </Button>
          </div>
        )}

        {counterDue && (
          <p className="mt-3 text-xs text-gray-500">
            You can decide once the counter is in, or when its 12-hour window closes.
          </p>
        )}

        {!decided && !counterDue && (
          <div className="mt-3">
            {reviewing ? (
              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={decision === "upheld" ? "primary" : "secondary"}
                    onClick={() => setDecision("upheld")}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Uphold
                  </Button>
                  <Button
                    size="sm"
                    variant={decision === "dismissed" ? "primary" : "secondary"}
                    onClick={() => setDecision("dismissed")}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                </div>
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="What did you find, and what happens now?"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={save} disabled={submitting}>
                    Save decision
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReviewing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={startReview}>
                Review &amp; resolve
              </Button>
            )}
          </div>
        )}
        <FormError message={error} className="mt-3" />
      </CardContent>
    </Card>
  );
});
