import { useEffect, useState } from "react";
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
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useMyCmoApplications, useSubmitCmoApplication } from "../../hooks/api";
import { RefreshStatus } from "../../components/RefreshStatus";
import Loading from "../../components/Loading";

interface CmoApplicationRow {
  id: string;
  referenceNo: string;
  cmoReference: string;
  schoolYear: string;
  purpose: string;
  description: string | null;
  fileUrl: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  notes: string | null;
}

function fmt(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AthleteCmoApplications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "athlete") navigate("/login");
  }, [user, navigate]);

  const applicationsQuery = useMyCmoApplications();
  const submitMut = useSubmitCmoApplication();
  const applications: CmoApplicationRow[] = applicationsQuery.data ?? [];
  const loading = applicationsQuery.isLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    cmoReference: "",
    schoolYear: "",
    purpose: "",
    description: "",
    file: null as File | null,
  });

  const openDialog = () => {
    setFormData({
      cmoReference: "",
      schoolYear: "",
      purpose: "",
      description: "",
      file: null,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cmoReference) return toast.error("CMO reference is required");
    if (!formData.schoolYear) return toast.error("School year is required");
    if (!formData.purpose) return toast.error("Purpose is required");

    try {
      await submitMut.mutateAsync(formData);
      toast.success("Application submitted for review");
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit application");
    }
  };

  if (!user) return null;
  if (loading)
    return <Loading fullScreen={false} message="Loading applications…" />;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            CMO Applications
          </h1>
          <RefreshStatus
            fetching={applicationsQuery.isFetching && !loading}
            error={applicationsQuery.isRefetchError}
            onRetry={() => applicationsQuery.refetch()}
          />
        </div>
        <Button onClick={openDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Application
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Applications</CardTitle>
          <CardDescription>
            Formal applications citing a CHED Memorandum Order, reviewed by
            the Sports Office.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              You haven't submitted a CMO application yet.
            </p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {app.referenceNo}
                    </p>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="mt-1 space-y-0.5 text-sm text-gray-600">
                    <p>
                      <strong>CMO cited:</strong> {app.cmoReference}
                    </p>
                    <p>
                      <strong>School year:</strong> {app.schoolYear}
                    </p>
                    <p>
                      <strong>Purpose:</strong> {app.purpose}
                    </p>
                    {app.description && <p>{app.description}</p>}
                  </div>
                  {app.fileUrl && (
                    <a
                      href={app.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      View attached file
                    </a>
                  )}
                  {app.status === "rejected" && app.notes && (
                    <p className="mt-2 text-sm text-red-700">
                      <strong>Office feedback:</strong> {app.notes}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Submitted {fmt(app.submittedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New CMO Application</DialogTitle>
            <DialogDescription>
              Submit a formal application citing the applicable CHED
              Memorandum Order for Sports Office review.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cmoReference">CMO Reference *</Label>
              <Input
                id="cmoReference"
                placeholder="e.g., CMO No. 21, s. 2021"
                value={formData.cmoReference}
                onChange={(e) =>
                  setFormData({ ...formData, cmoReference: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schoolYear">School Year *</Label>
              <Input
                id="schoolYear"
                placeholder="e.g., 2025-2026"
                value={formData.schoolYear}
                onChange={(e) =>
                  setFormData({ ...formData, schoolYear: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose *</Label>
              <Input
                id="purpose"
                placeholder="e.g., Athletic scholarship renewal"
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({ ...formData, purpose: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Additional Details</Label>
              <Textarea
                id="description"
                placeholder="Add any notes about this application..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Supporting Document (optional)</Label>
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
                {submitMut.isPending ? "Submitting..." : "Submit"}
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
  status: "pending" | "approved" | "rejected";
}) {
  if (status === "approved")
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Rejected
      </Badge>
    );
  return (
    <Badge variant="warning">
      <Clock className="mr-1 h-3 w-3" />
      Pending
    </Badge>
  );
}
