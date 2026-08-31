import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { TrendingUp, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAthletes,
  useEvents,
  usePerformanceRecords,
  useRecordPerformance,
} from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  department: string;
}

interface Event {
  id: string;
  name: string;
  sport: string;
  schedule: string;
}

interface PerformanceRecord {
  id: string;
  athleteId: string;
  athleteName: string;
  eventId: string;
  eventName: string;
  sport: string;
  metrics: Record<string, any>;
  overallRating: number;
  coachNotes: string;
  recordedAt: string;
}

export default function CoachPerformance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    athleteId: '',
    eventId: '',
    sport: '',
    overallRating: 5,
    coachNotes: '',
    // Sport-specific metrics
    points: '',
    assists: '',
    rebounds: '',
    time: '',
    distance: '',
    height: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const athletesQuery = useAthletes();
  const eventsQuery = useEvents();
  const performancesQuery = usePerformanceRecords();
  const recordPerf = useRecordPerformance();

  const athletes: Athlete[] = athletesQuery.data ?? [];
  const events: Event[] = useMemo(
    () => (eventsQuery.data ?? []).filter((e: Event) => e.sport),
    [eventsQuery.data],
  );
  const performances: PerformanceRecord[] = performancesQuery.data ?? [];
  const loading =
    athletesQuery.isLoading || eventsQuery.isLoading || performancesQuery.isLoading;
  const fetching =
    (athletesQuery.isFetching || eventsQuery.isFetching || performancesQuery.isFetching) &&
    !loading;
  const backgroundError =
    athletesQuery.isRefetchError ||
    eventsQuery.isRefetchError ||
    performancesQuery.isRefetchError;
  const retryAll = () => {
    athletesQuery.refetch();
    eventsQuery.refetch();
    performancesQuery.refetch();
  };
  const submitting = recordPerf.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.athleteId || !formData.eventId) {
      toast.error('Please select athlete and event');
      return;
    }

    try {
      const metrics: Record<string, any> = {};
      if (formData.points) metrics.points = Number(formData.points);
      if (formData.assists) metrics.assists = Number(formData.assists);
      if (formData.rebounds) metrics.rebounds = Number(formData.rebounds);
      if (formData.time) metrics.time = formData.time;
      if (formData.distance) metrics.distance = formData.distance;
      if (formData.height) metrics.height = formData.height;

      await recordPerf.mutateAsync({
        athleteId: formData.athleteId,
        eventId: formData.eventId,
        sport: formData.sport,
        metrics,
        overallRating: formData.overallRating,
        coachNotes: formData.coachNotes
      });

      toast.success('Performance recorded successfully');
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error recording performance:', error);
      toast.error(error.message || 'Failed to record performance');
    }
  };

  const resetForm = () => {
    setFormData({
      athleteId: '',
      eventId: '',
      sport: '',
      overallRating: 5,
      coachNotes: '',
      points: '',
      assists: '',
      rebounds: '',
      time: '',
      distance: '',
      height: '',
    });
  };

  const handleEventChange = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    setFormData(prev => ({
      ...prev,
      eventId,
      sport: event?.sport || ''
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-blue-600';
    if (rating >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Performance Records</h1>
            <RefreshStatus fetching={fetching} error={backgroundError} onRetry={retryAll} />
          </div>
          <p className="text-gray-600 mt-2">Track and analyze athlete performance</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Performance
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{performances.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {performances.filter(p => {
                const recorded = new Date(p.recordedAt);
                const now = new Date();
                return recorded.getMonth() === now.getMonth() && recorded.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {performances.length > 0
                ? (performances.reduce((sum, p) => sum + p.overallRating, 0) / performances.length).toFixed(1)
                : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Performance Records</CardTitle>
          <CardDescription>Latest athlete performance data</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading records...</div>
          ) : performances.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">No performance records yet</p>
              <p className="text-sm text-gray-400 mb-4">Start recording athlete performance</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Record First Performance
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {performances.map(record => (
                <div key={record.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{record.athleteName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{record.sport}</Badge>
                        <span className="text-sm text-gray-600">{record.eventName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getRatingColor(record.overallRating)}`}>
                        {record.overallRating}/10
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(record.recordedAt)}</p>
                    </div>
                  </div>

                  {Object.keys(record.metrics).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      {record.metrics.points !== undefined && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Points</p>
                          <p className="font-semibold">{record.metrics.points}</p>
                        </div>
                      )}
                      {record.metrics.assists !== undefined && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Assists</p>
                          <p className="font-semibold">{record.metrics.assists}</p>
                        </div>
                      )}
                      {record.metrics.rebounds !== undefined && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Rebounds</p>
                          <p className="font-semibold">{record.metrics.rebounds}</p>
                        </div>
                      )}
                      {record.metrics.time && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Time</p>
                          <p className="font-semibold">{record.metrics.time}</p>
                        </div>
                      )}
                      {record.metrics.distance && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Distance</p>
                          <p className="font-semibold">{record.metrics.distance}</p>
                        </div>
                      )}
                      {record.metrics.height && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Height</p>
                          <p className="font-semibold">{record.metrics.height}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {record.coachNotes && (
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-xs font-medium text-blue-900 mb-1">Coach Notes</p>
                      <p className="text-sm text-blue-800">{record.coachNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Performance Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Performance</DialogTitle>
            <DialogDescription>Enter athlete performance data</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="athleteId">Athlete *</Label>
                <select
                  id="athleteId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.athleteId}
                  onChange={(e) => setFormData({ ...formData, athleteId: e.target.value })}
                  required
                >
                  <option value="">Select athlete</option>
                  {athletes.map(athlete => (
                    <option key={athlete.id} value={athlete.id}>
                      {athlete.firstName} {athlete.lastName} - {athlete.studentId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventId">Event *</Label>
                <select
                  id="eventId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.eventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  required
                >
                  <option value="">Select event</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {event.sport}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overallRating">Overall Rating (1-10) *</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="overallRating"
                  min="1"
                  max="10"
                  value={formData.overallRating}
                  onChange={(e) => setFormData({ ...formData, overallRating: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className={`text-2xl font-bold ${getRatingColor(formData.overallRating)}`}>
                  {formData.overallRating}
                </span>
              </div>
            </div>

            {formData.sport && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Sport-Specific Metrics (Optional)</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="points">Points</Label>
                    <Input
                      id="points"
                      type="number"
                      placeholder="0"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assists">Assists</Label>
                    <Input
                      id="assists"
                      type="number"
                      placeholder="0"
                      value={formData.assists}
                      onChange={(e) => setFormData({ ...formData, assists: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rebounds">Rebounds</Label>
                    <Input
                      id="rebounds"
                      type="number"
                      placeholder="0"
                      value={formData.rebounds}
                      onChange={(e) => setFormData({ ...formData, rebounds: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      placeholder="e.g., 10:30"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="distance">Distance</Label>
                    <Input
                      id="distance"
                      placeholder="e.g., 100m"
                      value={formData.distance}
                      onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Height/Jump</Label>
                    <Input
                      id="height"
                      placeholder="e.g., 1.8m"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="coachNotes">Coach Notes</Label>
              <Textarea
                id="coachNotes"
                placeholder="Add observations, strengths, areas for improvement..."
                value={formData.coachNotes}
                onChange={(e) => setFormData({ ...formData, coachNotes: e.target.value })}
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Recording...' : 'Record Performance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
