import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { PageHeader } from "../../components/page/PageHeader";
import { StatStrip } from "../../components/page/StatStrip";
import { EmptyState } from "../../components/page/EmptyState";
import { RefreshStatus } from "../../components/RefreshStatus";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { CheckCircle, Mail, Phone, Search, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTryoutApplications, useUpdateTryoutStatus } from "../../hooks/api";

type Status = "pending" | "accepted" | "rejected";

interface Applicant {
  id: string;
  sport: string | null;
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
  department: string;
  phone: string;
  yearLevel: string;
  status: Status;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

const TABS: { value: Status; label: string }[] = [
  { value: "pending", label: "To decide" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Not accepted" },
];

const STATUS_BADGE: Record<Status, { label: string; variant: "warning" | "success" | "danger" }> = {
  pending: { label: "To decide", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Not accepted", variant: "danger" },
};

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

/**
 * Students who applied through a tryout announcement. The coach decides each
 * one: accepting adds them to the roster, rejecting closes it, and both email
 * the applicant. The office sees every coach's applicants on the same page.
 */
export default function Tryouts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user || (user.role !== "coach" && user.role !== "admin")) navigate("/login");
  }, [user, navigate]);

  const query = useTryoutApplications();
  const decide = useUpdateTryoutStatus();

  const [tab, setTab] = useState<Status>("pending");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ applicant: Applicant; status: "accepted" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const all: Applicant[] = query.data ?? [];
  const counts = useMemo(
    () => ({
      pending: all.filter((a) => a.status === "pending").length,
      accepted: all.filter((a) => a.status === "accepted").length,
      rejected: all.filter((a) => a.status === "rejected").length,
    }),
    [all],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((a) => a.status === tab)
      .filter(
        (a) =>
          !q ||
          `${a.firstName} ${a.lastName} ${a.studentId} ${a.department} ${a.sport ?? ""}`
            .toLowerCase()
            .includes(q),
      );
  }, [all, tab, search]);

  const openDecision = (applicant: Applicant, status: "accepted" | "rejected") => {
    setNote("");
    setTarget({ applicant, status });
  };

  const confirm = async () => {
    if (!target) return;
    const { applicant, status } = target;
    try {
      await decide.mutateAsync({ id: applicant.id, data: { status, note: note.trim() || undefined } });
      toast.success(
        status === "accepted"
          ? `${applicant.firstName} is on the roster. We emailed them the result.`
          : `Application closed. We emailed ${applicant.firstName} the result.`,
      );
      setTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Could not save the decision");
    }
  };

  if (!user) return null;

  return (
    <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Tryout Applicants"
        description={
          isAdmin
            ? "Students who applied through a tryout announcement, across every coach."
            : "Students who applied through your tryout announcements. Accepting one adds them to your roster."
        }
        actions={
          <RefreshStatus
            fetching={query.isFetching && !query.isLoading}
            error={query.isRefetchError}
            onRetry={() => query.refetch()}
          />
        }
      />

      <StatStrip
        stats={[
          { label: "To decide", value: counts.pending, tone: counts.pending ? "warning" : "default" },
          { label: "Accepted", value: counts.accepted, tone: "success" },
          { label: "Not accepted", value: counts.rejected },
          { label: "Total", value: all.length },
        ]}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border bg-white p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[t.value]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, SR Code, college…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading applicants…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={
              search
                ? `No applicants match "${search}"`
                : tab === "pending"
                  ? "No one is waiting on a decision"
                  : tab === "accepted"
                    ? "No one accepted yet"
                    : "No one turned down"
            }
            description={
              tab === "pending" && !search && !isAdmin ? (
                <>
                  Students apply from a tryout announcement on the public site.{" "}
                  <Link to="/coach/announcements" className="font-medium text-primary hover:underline">
                    Post one
                  </Link>{" "}
                  to open applications.
                </>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">
                      {a.firstName} {a.lastName}
                    </p>
                    <span className="text-xs tabular-nums text-slate-500">{a.studentId}</span>
                    {a.sport && <Badge variant="neutral">{a.sport}</Badge>}
                    {a.status !== "pending" && (
                      <Badge variant={STATUS_BADGE[a.status].variant}>{STATUS_BADGE[a.status].label}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {a.department} · {a.yearLevel}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-slate-800">
                      <Mail className="h-3 w-3" />
                      {a.email}
                    </a>
                    <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 hover:text-slate-800">
                      <Phone className="h-3 w-3" />
                      {a.phone}
                    </a>
                    <span>Applied {formatDate(a.appliedAt)}</span>
                    {a.reviewedAt && <span>Decided {formatDate(a.reviewedAt)}</span>}
                  </div>
                  {a.reviewNote && (
                    <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Note:</span> {a.reviewNote}
                    </p>
                  )}
                </div>
                {a.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => openDecision(a, "rejected")}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Not accepted
                    </Button>
                    <Button size="sm" onClick={() => openDecision(a, "accepted")}>
                      <CheckCircle className="mr-1.5 h-4 w-4" />
                      Accept
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.status === "accepted" ? "Accept" : "Turn down"} {target?.applicant.firstName}{" "}
              {target?.applicant.lastName}?
            </DialogTitle>
            <DialogDescription>
              {target?.status === "accepted"
                ? "They'll be added to the roster as an active athlete, and emailed that they made the team."
                : "The application is closed and they're emailed that they didn't get a slot this time."}{" "}
              This can't be changed afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="tryout-note" className="text-sm font-medium">
              Note to the applicant <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <Textarea
              id="tryout-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                target?.status === "accepted"
                  ? "e.g. First practice is Monday, 4 PM at the gym."
                  : "e.g. Try again next semester, work on your endurance."
              }
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirm}
              disabled={decide.isPending}
              className={target?.status === "rejected" ? "bg-red-600 hover:bg-red-700" : undefined}
            >
              {decide.isPending ? "Saving…" : target?.status === "accepted" ? "Accept and add to roster" : "Turn down"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
