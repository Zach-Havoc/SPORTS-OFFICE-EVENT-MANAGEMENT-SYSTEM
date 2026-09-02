import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { MapPin, Plus, Edit, Trash2, Building } from 'lucide-react';
import { toast } from 'sonner';
import {
  useVenues,
  useCreateVenue,
  useUpdateVenue,
  useDeleteVenue,
} from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';

interface Venue {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor' | 'open';
  capacity: number;
  sports: string[];
  location: string;
  facilities: string;
  status: 'available' | 'maintenance' | 'unavailable';
  createdAt: string;
}

export default function AdminVenues() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'open' as 'indoor' | 'outdoor' | 'open',
    capacity: 100,
    sports: [] as string[],
    location: '',
    facilities: '',
    status: 'available' as 'available' | 'maintenance' | 'unavailable'
  });

  const [sportInput, setSportInput] = useState('');

  const sportsSuggestions = [
    'Basketball', 'Volleyball', 'Badminton', 'Football',
    'Track & Field', 'Swimming', 'Tennis', 'Table Tennis'
  ];

  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/login');
  }, [user, navigate]);

  const venuesQuery = useVenues();
  const createMut = useCreateVenue();
  const updateMut = useUpdateVenue();
  const deleteMut = useDeleteVenue();

  const venues: Venue[] = useMemo(
    () =>
      (venuesQuery.data ?? []).map((v: any) => ({
        ...v,
        sports: v.sports ?? [],
        facilities: v.facilities ?? '',
      })),
    [venuesQuery.data],
  );
  const loading = venuesQuery.isLoading;
  const submitting = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.location) {
      toast.error('Name and location are required');
      return;
    }

    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: formData });
        toast.success('Venue updated successfully');
      } else {
        await createMut.mutateAsync(formData);
        toast.success('Venue created successfully');
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving venue:', error);
      toast.error(error.message || 'Failed to save venue');
    }
  };

  const handleEdit = (venue: Venue) => {
    setEditingId(venue.id);
    setFormData({
      name: venue.name,
      type: venue.type,
      capacity: venue.capacity,
      sports: venue.sports ?? [],
      location: venue.location,
      facilities: venue.facilities ?? '',
      status: venue.status
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await deleteMut.mutateAsync(id);
      toast.success('Venue deleted successfully');
    } catch (error) {
      console.error('Error deleting venue:', error);
      toast.error('Failed to delete venue');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'open',
      capacity: 100,
      sports: [],
      location: '',
      facilities: '',
      status: 'available'
    });
    setEditingId(null);
    setSportInput('');
  };

  const addSport = (sport: string) => {
    if (sport && !formData.sports.includes(sport)) {
      setFormData(prev => ({ ...prev, sports: [...prev.sports, sport] }));
      setSportInput('');
    }
  };

  const removeSport = (sport: string) => {
    setFormData(prev => ({
      ...prev,
      sports: prev.sports.filter(s => s !== sport)
    }));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'indoor': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'outdoor': return 'bg-green-100 text-green-800 border-green-300';
      case 'open': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 border-green-300';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'unavailable': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Venue Management</h1>
            <RefreshStatus
              fetching={venuesQuery.isFetching && !loading}
              error={venuesQuery.isRefetchError}
              onRetry={() => venuesQuery.refetch()}
            />
          </div>
          <p className="text-gray-600 mt-2">Manage sports facilities and venues</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Venue
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Venues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{venues.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Indoor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {venues.filter(v => v.type === 'indoor').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Outdoor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {venues.filter(v => v.type === 'outdoor').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Open Spaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {venues.filter(v => v.type === 'open').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Venues Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-gray-500">
              Loading venues...
            </CardContent>
          </Card>
        ) : venues.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Building className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">No venues configured</p>
              <p className="text-sm text-gray-400 mb-4">Add your first venue to get started</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Venue
              </Button>
            </CardContent>
          </Card>
        ) : (
          venues.map(venue => (
            <Card key={venue.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{venue.name}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getTypeColor(venue.type)}>
                        {venue.type}
                      </Badge>
                      <Badge className={getStatusColor(venue.status)}>
                        {venue.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-600">{venue.location}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Capacity</p>
                    <p className="text-sm text-gray-600">{venue.capacity} people</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Sports</p>
                    <div className="flex flex-wrap gap-1">
                      {venue.sports.length > 0 ? (
                        venue.sports.map(sport => (
                          <Badge key={sport} variant="outline" className="text-xs">
                            {sport}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No sports specified</span>
                      )}
                    </div>
                  </div>

                  {venue.facilities && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Facilities</p>
                      <p className="text-sm text-gray-600">{venue.facilities}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(venue)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(venue.id, venue.name)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Venue' : 'Add New Venue'}</DialogTitle>
            <DialogDescription>
              Configure venue details and supported sports
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Venue Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Gymnasium"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Venue Type *</Label>
                <select
                  id="type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  required
                >
                  <option value="indoor">Indoor - Enclosed facilities (e.g., gym)</option>
                  <option value="outdoor">Outdoor - Open field (e.g., football field)</option>
                  <option value="open">Open Space - Multi-purpose area</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <select
                  id="status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  required
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Under Maintenance</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., Building A, Ground Floor"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Supported Sports</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type sport name or select below"
                  value={sportInput}
                  onChange={(e) => setSportInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSport(sportInput);
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => addSport(sportInput)}
                  disabled={!sportInput}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {sportsSuggestions.map(sport => (
                  <Button
                    key={sport}
                    type="button"
                    size="sm"
                    variant={formData.sports.includes(sport) ? "default" : "outline"}
                    onClick={() => {
                      if (formData.sports.includes(sport)) {
                        removeSport(sport);
                      } else {
                        addSport(sport);
                      }
                    }}
                  >
                    {sport}
                  </Button>
                ))}
              </div>
              {formData.sports.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 p-2 bg-gray-50 rounded">
                  {formData.sports.map(sport => (
                    <Badge key={sport} className="cursor-pointer" onClick={() => removeSport(sport)}>
                      {sport} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="facilities">Facilities (Optional)</Label>
              <Textarea
                id="facilities"
                placeholder="e.g., Locker rooms, Scoreboards, Seating area"
                value={formData.facilities}
                onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update Venue' : 'Create Venue'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
