import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { FileText, Plus, CheckCircle, XCircle, Clock, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { getMyRequirements, submitRequirement } from '../../services/api';

interface Requirement {
  id: string;
  type: string;
  name: string;
  description: string;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt: string | null;
  notes: string;
}

export default function AthleteRequirements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    type: 'waiver',
    name: '',
    description: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'athlete') {
      navigate('/login');
      return;
    }
    loadRequirements();
  }, [user, navigate]);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const data = await getMyRequirements();
      setRequirements(data);
    } catch (error) {
      console.error('Error loading requirements:', error);
      toast.error('Failed to load requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Document name is required');
      return;
    }

    try {
      setSubmitting(true);
      await submitRequirement(formData);
      toast.success('Requirement submitted successfully');
      setDialogOpen(false);
      resetForm();
      loadRequirements();
    } catch (error: any) {
      console.error('Error submitting requirement:', error);
      toast.error(error.message || 'Failed to submit requirement');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'waiver',
      name: '',
      description: ''
    });
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

  const pendingCount = requirements.filter(r => r.status === 'pending').length;
  const approvedCount = requirements.filter(r => r.status === 'approved').length;
  const rejectedCount = requirements.filter(r => r.status === 'rejected').length;

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Requirements</h1>
          <p className="text-gray-600 mt-2">Submit and track your document requirements</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Submit Document
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{requirements.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{approvedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Requirements Info */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Required Documents</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Waiver Form (signed)</li>
                <li>• Certificate of Enrollment (current semester)</li>
                <li>• Medical Clearance Certificate</li>
                <li>• Parental Consent (if under 18)</li>
                <li>• Other documents as requested by your coach</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements List */}
      <Card>
        <CardHeader>
          <CardTitle>My Submissions</CardTitle>
          <CardDescription>Track your submitted requirements</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading requirements...</div>
          ) : requirements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">No requirements submitted yet</p>
              <p className="text-sm text-gray-400 mb-4">Start by submitting your first document</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Submit First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {requirements.map(req => (
                <div key={req.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{req.name}</h4>
                        <Badge className={getStatusColor(req.status)}>
                          {getStatusIcon(req.status)}
                          <span className="ml-1 capitalize">{req.status}</span>
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><strong>Type:</strong> {req.type}</p>
                        {req.description && <p><strong>Description:</strong> {req.description}</p>}
                        <p className="text-xs text-gray-500">Submitted {formatDate(req.submittedAt)}</p>
                        {req.reviewedAt && (
                          <p className="text-xs text-gray-500">Reviewed {formatDate(req.reviewedAt)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {req.notes && req.status !== 'pending' && (
                    <div className={`rounded p-3 ${
                      req.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <p className={`text-xs font-medium mb-1 ${
                        req.status === 'approved' ? 'text-green-900' : 'text-red-900'
                      }`}>
                        Coach Feedback
                      </p>
                      <p className={`text-sm ${
                        req.status === 'approved' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {req.notes}
                      </p>
                    </div>
                  )}

                  {req.status === 'rejected' && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-600 mb-2">
                        This requirement was rejected. Please resubmit with corrections.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Requirement</DialogTitle>
            <DialogDescription>
              Upload your required documents for coach review
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Document Type *</Label>
              <select
                id="type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              >
                <option value="waiver">Waiver Form</option>
                <option value="certificate">Certificate of Enrollment</option>
                <option value="medical">Medical Clearance</option>
                <option value="parental_consent">Parental Consent</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Document Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Signed Waiver Form 2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any notes about this document..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Upload className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">File Upload Placeholder</p>
                  <p className="text-sm text-blue-700 mt-1">
                    In a production system, you would upload the actual document file here.
                    For this demo, the submission is recorded without file storage.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Document'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
