import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
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
import { CheckCircle, XCircle, Clock, Download, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { useRequirements, useUpdateRequirementStatus } from "../../hooks/api";
import { RefreshStatus } from "../../components/RefreshStatus";

interface Requirement {
  id: string;
  athleteId: string;
  athleteName: string;
  type: string;
  name: string;
  description: string;
  fileUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string;
}

/**
 * The Sports Office's view of the same CMO requirements a coach reviews —
 * the athlete submits it, the coach looks at it first, and it also lands
 * here for the office's own sign-off. Same data, same statuses, no separate
 * module: RequirementController already returns every submission (not just
 * a roster) and skips the roster check for any caller that isn't a coach.
 */
export default function AdminRequirements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Requirement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/login");
  }, [user, navigate]);

  const requirementsQuery = useRequirements();
  const updateStatus = useUpdateRequirementStatus();

  const requirements: Requirement[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all: Requirement[] = requirementsQuery.data ?? [];
    if (!q) return all;
    return all.filter((r) => r.athleteName.toLowerCase().includes(q));
  }, [requirementsQuery.data, search]);
  const loading = requirementsQuery.isLoading;
  const fetching = requirementsQuery.isFetching && !loading;
  const processing = updateStatus.isPending;

  const pending = requirements.filter((r) => r.status === "pending");
  const reviewed = requirements.filter((r) => r.status !== "pending");

  const handleView = (req: Requirement) => {
    setSelected(req);
    setReviewNotes(req.notes || "");
    setDialogOpen(true);
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!selected) return;
    try {
      await updateStatus.mutateAsync({
        id: selected.id,
        data: { status, notes: reviewNotes },
      });
      toast.success(`Requirement ${status === "approved" ? "approved" : "rejected"}`);
      setDialogOpen(false);
      setSelected(null);
      setReviewNotes("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update requirement");
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusVariant = (
    status: string,
  ): "success" | "destructive" | "warning" =>
    status === "approved"
      ? "success"
      : status === "rejected"
        ? "destructive"
        : "warning";

  const statusIcon = (status: string) =>
    status === "approved" ? (
      <CheckCircle className="h-4 w-4" />
    ) : status === "rejected" ? (
      <XCircle className="h-4 w-4" />
    ) : (
      <Clock className="h-4 w-4" />
    );

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">CMO Requirements</h1>
          <RefreshStatus
            fetching={fetching}
            error={requirementsQuery.isRefetchError}
            onRetry={() => requirementsQuery.refetch()}
          />
        </div>
        <p className="mt-2 text-gray-600">
          The Sports Office's view of the documents athletes submit — same
          checklist the coach reviews.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{requirements.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{pending.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {requirements.filter((r) => r.status === "approved").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {requirements.filter((r) => r.status === "rejected").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative mb-6">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by athlete name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm pl-10"
        />
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pending Review ({pending.length})</CardTitle>
          <CardDescription>Documents awaiting a decision</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading requirements...</div>
          ) : pending.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p className="text-gray-500">All caught up! No pending requirements</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-lg font-semibold">{req.athleteName}</h4>
                        <Badge variant={statusVariant(req.status)}>
                          {statusIcon(req.status)}
                          <span className="ml-1">{req.status}</span>
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <strong>Type:</strong> {req.type}
                        </p>
                        <p>
                          <strong>Document:</strong> {req.name}
                        </p>
                        {req.description && (
                          <p>
                            <strong>Description:</strong> {req.description}
                          </p>
                        )}
                        {req.fileUrl && (
                          <div className="mt-2">
                            <a
                              href={req.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              <Download className="mr-1 h-4 w-4" />
                              View/Download File
                            </a>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Submitted {formatDate(req.submittedAt)}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleView(req)}>
                      <Eye className="mr-1 h-4 w-4" />
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reviewed ({reviewed.length})</CardTitle>
            <CardDescription>Previously reviewed documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reviewed.map((req) => (
                <div key={req.id} className="rounded-lg border bg-gray-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-semibold">{req.athleteName}</h4>
                    <Badge variant={statusVariant(req.status)}>
                      {statusIcon(req.status)}
                      <span className="ml-1">{req.status}</span>
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <strong>Type:</strong> {req.type} - {req.name}
                    </p>
                    {req.fileUrl && (
                      <a
                        href={req.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        View File
                      </a>
                    )}
                    <p className="text-xs text-gray-500">
                      Reviewed {req.reviewedAt ? formatDate(req.reviewedAt) : "N/A"}
                    </p>
                    {req.notes && (
                      <div className="mt-2 rounded bg-white p-2">
                        <p className="text-xs font-medium text-gray-700">Review Notes:</p>
                        <p className="text-sm text-gray-600">{req.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Requirement</DialogTitle>
            <DialogDescription>
              Review and approve or reject this document submission
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gray-50 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Athlete</p>
                    <p className="text-gray-900">{selected.athleteName}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Type</p>
                    <p className="text-gray-900">{selected.type}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-medium text-gray-700">Document Name</p>
                    <p className="text-gray-900">{selected.name}</p>
                  </div>
                  {selected.description && (
                    <div className="col-span-2">
                      <p className="font-medium text-gray-700">Description</p>
                      <p className="text-gray-900">{selected.description}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="font-medium text-gray-700">Submitted</p>
                    <p className="text-gray-900">{formatDate(selected.submittedAt)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Review Notes</label>
                <Textarea
                  placeholder="Add feedback or notes about this submission..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {selected.fileUrl && (
                <div className="rounded-lg border bg-gray-50 p-4">
                  <p className="mb-2 font-medium text-gray-700">Uploaded File</p>
                  <a
                    href={selected.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    View/Download Document
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => handleReview("rejected")}
              disabled={processing}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              type="button"
              onClick={() => handleReview("approved")}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {processing ? "Processing..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
