import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Plus, Edit, Trash2, Megaphone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';

interface Announcement {
  id: string;
  title: string;
  content: string;
  sport: string;
  coachId: string;
  coachName: string;
  isTryout: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CoachAnnouncements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    sport: '',
    isTryout: true,
  });

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const announcementsQuery = useAnnouncements();
  const createMut = useCreateAnnouncement();
  const updateMut = useUpdateAnnouncement();
  const deleteMut = useDeleteAnnouncement();

  const announcements: Announcement[] = useMemo(
    () => (announcementsQuery.data ?? []).filter((a: Announcement) => a.coachId === user?.id),
    [announcementsQuery.data, user?.id],
  );
  const loading = announcementsQuery.isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: formData });
        toast.success('Announcement updated successfully');
      } else {
        await createMut.mutateAsync(formData);
        toast.success('Announcement created successfully');
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving announcement:', error);
      toast.error(error.message || 'Failed to save announcement');
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      sport: announcement.sport || '',
      isTryout: announcement.isTryout,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await deleteMut.mutateAsync(id);
      toast.success('Announcement deleted successfully');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', sport: '', isTryout: true });
    setEditingId(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
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

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">My Announcements</h1>
            <RefreshStatus
              fetching={announcementsQuery.isFetching && !loading}
              error={announcementsQuery.isRefetchError}
              onRetry={() => announcementsQuery.refetch()}
            />
          </div>
          <p className="text-gray-600 mt-2">Create and manage announcements for tryouts and events</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Loading announcements...
            </CardContent>
          </Card>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">No announcements yet</p>
              <p className="text-sm text-gray-400 mb-4">Create your first announcement to reach out to athletes</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Announcement
              </Button>
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{announcement.title}</CardTitle>
                      {announcement.sport && (
                        <Badge variant="secondary">{announcement.sport}</Badge>
                      )}
                      {announcement.isTryout && (
                        <Badge variant="default" className="bg-red-600">Tryout</Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(announcement.createdAt)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(announcement)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(announcement.id, announcement.title)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{announcement.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Announcement' : 'Create New Announcement'}</DialogTitle>
            <DialogDescription>
              Share important updates about tryouts, practices, or upcoming games
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Basketball Tryouts - Open Registration"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sport">Sport (Optional)</Label>
              <Input
                id="sport"
                placeholder="e.g., Basketball, Volleyball"
                value={formData.sport}
                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
              />
              <p className="text-xs text-gray-500">Specify which sport this announcement is for</p>
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="isTryout">Tryout Announcement</Label>
                <p className="text-sm text-gray-500">
                  Allow athletes to apply for tryouts directly from this announcement.
                </p>
              </div>
              <Switch
                id="isTryout"
                checked={formData.isTryout}
                onCheckedChange={(checked) => setFormData({ ...formData, isTryout: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Write your announcement here... Include details like date, time, location, requirements, etc."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? 'Update Announcement' : 'Create Announcement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
