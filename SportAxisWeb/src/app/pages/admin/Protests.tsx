import { useCallback, useEffect, useState, memo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useProtests, useResolveProtest } from "../../hooks/api";
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
import { Gavel, CheckCircle2, XCircle } from "lucide-react";
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

export default function AdminProtests() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/login");
  }, [user, navigate]);

  const [status, setStatus] = useState("all");
  const query = useProtests(status === "all" ? {} : { status });
  const resolve = useResolveProtest();

  const protests = query.data ?? [];

  // Stable across renders so a keystroke in one card's resolution textarea
  // doesn't re-render every other (memoized) card in the list.
  const submit = useCallback(
    (p: Protest, decision: "upheld" | "dismissed", resolution: string, onDone: () => void) => {
      if (resolution.trim().length < 10) {
        toast.error("Write a short resolution note (at least 10 characters).");
        return;
      }
      resolve.mutate(
        { id: p.id, data: { status: decision, resolution: resolution.trim() } },
        {
          onSuccess: () => {
            toast.success(`Protest ${decision}`);
            onDone();
          },
          onError: (e: any) => toast.error(e?.message || "Could not resolve"),
        },
      );
    },
    [resolve],
  );

  if (query.isLoading)
    return <Loading fullScreen={false} message="Loading protests…" />;

  return (
    <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-gray-400" />
          <h1 className="t-page-title">
            Protests
          </h1>
          <RefreshStatus
            fetching={query.isFetching && !query.isLoading}
            error={query.isRefetchError}
            onRetry={query.refetch}
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Complaints filed by coaches about event outcomes. Uphold or dismiss
          each with a written note; the coach sees your decision.
        </p>
      </div>

      <div className="mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All protests</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="upheld">Upheld</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {protests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            No protests.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {protests.map((p) => (
            <ProtestCard
              key={p.id}
              protest={p}
              onSubmit={submit}
              submitting={resolve.isPending}
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
  onSubmit,
  submitting,
}: {
  protest: Protest;
  onSubmit: (
    p: Protest,
    decision: "upheld" | "dismissed",
    resolution: string,
    onDone: () => void,
  ) => void;
  submitting: boolean;
}) {
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
          <Badge className={`text-[11px] capitalize ${STATUS_STYLE[p.status]}`}>
            {p.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {p.reason}
        </p>

        {p.status !== "open" && p.resolution && (
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

        {p.status === "open" && (
          <div className="mt-3">
            {reviewing ? (
              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={decision === "upheld" ? "default" : "outline"}
                    onClick={() => setDecision("upheld")}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Uphold
                  </Button>
                  <Button
                    size="sm"
                    variant={decision === "dismissed" ? "default" : "outline"}
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
              <Button size="sm" variant="outline" onClick={startReview}>
                Review &amp; resolve
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
