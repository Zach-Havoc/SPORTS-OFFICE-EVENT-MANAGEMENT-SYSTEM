import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { CheckCircle, XCircle, Clock, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useRequirements, useUpdateRequirementStatus } from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';

interface Requirement {
  id: string;
  athleteId: string;
  athleteName: string;
  type: string;
  name: string;
  description: string;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string;
}

export default function CoachRequirements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const requirementsQuery = useRequirements();
  const updateStatus = useUpdateRequirementStatus();

  const requirements: Requirement[] = requirementsQuery.data ?? [];
  const loading = requirementsQuery.isLoading;
  const fetching = requirementsQuery.isFetching && !loading;
  const processing = updateStatus.isPending;

  const handleViewRequirement = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setReviewNotes(requirement.notes || '');
    setDialogOpen(true);
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRequirement) return;

    try {
      await updateStatus.mutateAsync({
        id: selectedRequirement.id,
        data: { status, notes: reviewNotes },
      });

      toast.success(`Requirement ${status === 'approved' ? 'approved' : 'rejected'} successfully`);
      setDialogOpen(false);
      setSelectedRequirement(null);
      setReviewNotes('');
    } catch (error: any) {
      console.error('Error updating requirement:', error);
      toast.error(error.message || 'Failed to update requirement');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return null;
    }
  };

  const pendingRequirements = requirements.filter(r => r.status === 'pending');
  const reviewedRequirements = requirements.filter(r => r.status !== 'pending');

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Requirements Management</h1>
          <RefreshStatus
            fetching={fetching}
            error={requirementsQuery.isRefetchError}
            onRetry={() => requirementsQuery.refetch()}
          />
        </div>
        <p className="text-gray-600 mt-2">Review and approve athlete document submissions</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Submissions</CardTitle>
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
            <div className="text-3xl font-bold text-yellow-600">{pendingRequirements.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {requirements.filter(r => r.status === 'approved').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {requirements.filter(r => r.status === 'rejected').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requirements */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pending Review ({pendingRequirements.length})</CardTitle>
          <CardDescription>Requirements awaiting your review</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading requirements...</div>
          ) : pendingRequirements.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">All caught up! No pending requirements</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequirements.map(req => (
                <div key={req.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{req.athleteName}</h4>
                        <Badge className={getStatusColor(req.status)}>
                          {getStatusIcon(req.status)}
                          <span className="ml-1">{req.status}</span>
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><strong>Type:</strong> {req.type}</p>
                        <p><strong>Document:</strong> {req.name}</p>
                        {req.description && <p><strong>Description:</strong> {req.description}</p>}
                        {req.fileUrl && (
                          <div className="mt-2">
                            <a
                              href={req.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              View/Download File
                            </a>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">Submitted {formatDate(req.submittedAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewRequirement(req)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviewed Requirements */}
      {reviewedRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reviewed ({reviewedRequirements.length})</CardTitle>
            <CardDescription>Previously reviewed requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reviewedRequirements.map(req => (
                <div key={req.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{req.athleteName}</h4>
                        <Badge className={getStatusColor(req.status)}>
                          {getStatusIcon(req.status)}
                          <span className="ml-1">{req.status}</span>
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><strong>Type:</strong> {req.type} - {req.name}</p>
                        {req.fileUrl && (
                          <a
                            href={req.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            View File
                          </a>
                        )}
                        <p className="text-xs text-gray-500">
                          Reviewed {req.reviewedAt ? formatDate(req.reviewedAt) : 'N/A'}
                        </p>
                        {req.notes && (
                          <div className="mt-2 bg-white rounded p-2">
                            <p className="text-xs font-medium text-gray-700">Review Notes:</p>
                            <p className="text-sm text-gray-600">{req.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Requirement</DialogTitle>
            <DialogDescription>
              Review and approve or reject this document submission
            </DialogDescription>
          </DialogHeader>

          {selectedRequirement && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Athlete</p>
                    <p className="text-gray-900">{selectedRequirement.athleteName}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Type</p>
                    <p className="text-gray-900">{selectedRequirement.type}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-medium text-gray-700">Document Name</p>
                    <p className="text-gray-900">{selectedRequirement.name}</p>
                  </div>
                  {selectedRequirement.description && (
                    <div className="col-span-2">
                      <p className="font-medium text-gray-700">Description</p>
                      <p className="text-gray-900">{selectedRequirement.description}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="font-medium text-gray-700">Submitted</p>
                    <p className="text-gray-900">{formatDate(selectedRequirement.submittedAt)}</p>
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

              {selectedRequirement.fileUrl && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="font-medium text-gray-700 mb-2">Uploaded File</p>
                  <a
                    href={selectedRequirement.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    View/Download Document
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => handleReview('rejected')}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              type="button"
              onClick={() => handleReview('approved')}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {processing ? 'Processing...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
