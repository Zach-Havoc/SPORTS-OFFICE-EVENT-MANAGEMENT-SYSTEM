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
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Upload,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  useMyRequirements,
  useSubmitRequirement,
  useMyClearance,
  useRequirementTypes,
  useMyCoach,
} from "../../hooks/api";
import type { RequirementTypeRow } from "../../services/api";
import { RefreshStatus } from "../../components/RefreshStatus";
import Loading from "../../components/Loading";

interface RequirementRow {
  id: string;
  athleteId: string;
  athleteName: string;
  type: string;
  requirementTypeId: string | null;
  supersedesId: string | null;
  name: string;
  description: string;
  fileUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt: string | null;
  notes: string;
}

function fmt(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AthleteRequirements() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "athlete") navigate("/login");
  }, [user, navigate]);

  const coachQuery = useMyCoach();
  const mySport: string | undefined = coachQuery.data?.sport || undefined;

  const requirementsQuery = useMyRequirements();
  const clearanceQuery = useMyClearance();
  const typesQuery = useRequirementTypes(mySport);
  const submitMut = useSubmitRequirement();

  const requirements: RequirementRow[] = requirementsQuery.data ?? [];
  const types: RequirementTypeRow[] = typesQuery.data ?? [];
  const loading = requirementsQuery.isLoading || typesQuery.isLoading;

  // A row that's been resubmitted is hidden from the primary list; it still
  // shows up as "an earlier attempt" under the row that replaced it.
  const supersededIds = useMemo(
    () =>
      new Set(
        requirements
          .map((r) => r.supersedesId)
          .filter((id): id is string => !!id),
      ),
    [requirements],
  );

  const latestByType = useMemo(() => {
    const map = new Map<string, RequirementRow>();
    for (const r of requirements) {
      if (!r.requirementTypeId || supersededIds.has(r.id)) continue;
      const existing = map.get(r.requirementTypeId);
      if (!existing || r.submittedAt > existing.submittedAt)
        map.set(r.requirementTypeId, r);
    }
    return map;
  }, [requirements, supersededIds]);

  const priorAttempt = (row: RequirementRow | undefined) =>
    row ? requirements.find((r) => r.id === row.supersedesId) : undefined;

  const otherSubmissions = useMemo(
    () =>
      requirements.filter(
        (r) => !r.requirementTypeId && !supersededIds.has(r.id),
      ),
    [requirements, supersededIds],
  );

  // ── Submit / resubmit dialog ─────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [target, setTarget] = useState<{
    type?: RequirementTypeRow;
    supersedes?: RequirementRow;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    file: null as File | null,
  });

  const openFor = (type?: RequirementTypeRow, supersedes?: RequirementRow) => {
    setTarget({ type, supersedes });
    setFormData({ name: type?.name ?? "", description: "", file: null });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Document name is required");
    if (!formData.file) return toast.error("Please select a file to upload");

    try {
      await submitMut.mutateAsync({
        type: target?.type ? "checklist" : "other",
        requirementTypeId: target?.type?.id,
        supersedesId: target?.supersedes?.id,
        name: formData.name,
        description: formData.description,
        file: formData.file,
      });
      toast.success(
        target?.supersedes ? "Resubmitted for review" : "Submitted for review",
      );
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit requirement");
    }
  };

  if (!user) return null;
  if (loading)
    return <Loading fullScreen={false} message="Loading requirements…" />;

  const clearance = clearanceQuery.data;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="t-page-title">
          My CMO Requirements
        </h1>
        <RefreshStatus
          fetching={requirementsQuery.isFetching && !loading}
          error={requirementsQuery.isRefetchError}
          onRetry={() => requirementsQuery.refetch()}
        />
      </div>

      {/* Clearance banner */}
      {clearance && (
        <Card
          className={`mb-6 border-2 ${clearance.cleared ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
        >
          <CardContent className="flex items-center gap-4 py-5">
            {clearance.cleared ? (
              <ShieldCheck className="h-9 w-9 shrink-0 text-green-600" />
            ) : (
              <ShieldAlert className="h-9 w-9 shrink-0 text-amber-600" />
            )}
            <div>
              <p
                className={`text-lg font-bold ${clearance.cleared ? "text-green-800" : "text-amber-800"}`}
              >
                {clearance.cleared
                  ? "Cleared to play"
                  : `${clearance.missing.length} document${clearance.missing.length === 1 ? "" : "s"} outstanding`}
              </p>
              <p
                className={`text-sm ${clearance.cleared ? "text-green-700" : "text-amber-700"}`}
              >
                {clearance.cleared
                  ? `Approved: ${clearance.approvedCount}/${clearance.requiredCount} required documents.`
                  : `Missing: ${clearance.missing.map((m) => m.name).join(", ")}`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Required Documents</CardTitle>
          <CardDescription>
            What your college needs on file before you can compete.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {types.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No checklist items configured yet.
            </p>
          ) : (
            types.map((t) => {
              const row = latestByType.get(t.id);
              const prior = priorAttempt(row);
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      <StatusBadge status={row?.status ?? null} />
                    </div>
                    {t.description && (
                      <p className="text-sm text-gray-500">{t.description}</p>
                    )}
                    {t.templateFileUrl && (
                      <a
                        href={t.templateFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        <FileText className="mr-1 h-3.5 w-3.5" />
                        Download blank form
                      </a>
                    )}
                    {row?.status === "rejected" && row.notes && (
                      <p className="mt-1 text-sm text-red-700">
                        <strong>Coach feedback:</strong> {row.notes}
                      </p>
                    )}
                    {row && (
                      <p className="mt-1 text-xs text-gray-400">
                        {row.status === "pending"
                          ? "Submitted"
                          : row.status === "approved"
                            ? "Approved"
                            : "Submitted"}{" "}
                        {fmt(row.submittedAt)}
                        {prior && " · resubmission"}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {!row || row.status === "rejected" ? (
                      <Button
                        size="sm"
                        variant={row ? "outline" : "default"}
                        onClick={() => openFor(t, row)}
                      >
                        {row ? (
                          <RotateCcw className="mr-1.5 h-4 w-4" />
                        ) : (
                          <Upload className="mr-1.5 h-4 w-4" />
                        )}
                        {row ? "Resubmit" : "Submit"}
                      </Button>
                    ) : row.fileUrl ? (
                      <a
                        href={row.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        <FileText className="mr-1 h-4 w-4" />
                        View file
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Other / freeform submissions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Other Documents</CardTitle>
            <CardDescription>
              Anything your coach asked for outside the checklist.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => openFor()}>
            <Upload className="mr-1.5 h-4 w-4" />
            Submit
          </Button>
        </CardHeader>
        <CardContent>
          {otherSubmissions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Nothing submitted here yet.
            </p>
          ) : (
            <div className="space-y-3">
              {otherSubmissions.map((req) => (
                <div key={req.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{req.name}</p>
                    <StatusBadge status={req.status} />
                  </div>
                  {req.description && (
                    <p className="text-sm text-gray-600">{req.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Submitted {fmt(req.submittedAt)}
                  </p>
                  {req.notes && req.status === "rejected" && (
                    <p className="mt-1 text-sm text-red-700">{req.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit / resubmit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {target?.supersedes ? "Resubmit document" : "Submit document"}
            </DialogTitle>
            <DialogDescription>
              {target?.type
                ? `Upload your ${target.type.name.toLowerCase()} for your coach to review.`
                : "Upload a document your coach requested."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!target?.type && (
              <div className="space-y-2">
                <Label htmlFor="name">Document Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Fitness Test Result"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Notes (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any notes about this document..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Document File *</Label>
              <Input
                id="file"
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    file: e.target.files?.[0] || null,
                  })
                }
                required
              />
              <p className="text-xs text-gray-500">
                Images, PDF, or Word. Max 10MB.
              </p>
              {formData.file && (
                <p className="text-sm text-green-600">
                  Selected: {formData.file.name} (
                  {(formData.file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitMut.isPending}>
                {submitMut.isPending
                  ? "Submitting..."
                  : target?.supersedes
                    ? "Resubmit"
                    : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "pending" | "approved" | "rejected" | null;
}) {
  if (!status)
    return (
      <Badge className="border-gray-300 bg-gray-100 text-gray-600">
        Missing
      </Badge>
    );
  if (status === "approved")
    return (
      <Badge className="border-green-300 bg-green-100 text-green-800">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge className="border-red-300 bg-red-100 text-red-800">
        <XCircle className="mr-1 h-3 w-3" />
        Rejected
      </Badge>
    );
  return (
    <Badge className="border-yellow-300 bg-yellow-100 text-yellow-800">
      <Clock className="mr-1 h-3 w-3" />
      Pending
    </Badge>
  );
}
