import { StatStrip } from '../../components/page/StatStrip';
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
import { TrendingUp, Plus, Trash2, Search } from 'lucide-react';
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
  sport?: string | null;
}

interface Event {
  id: string;
  name: string;
  // The API calls the sport "category" on events.
  category: string;
  schedule: string;
  departments: string[];
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
  });
  const [metricRows, setMetricRows] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [search, setSearch] = useState('');

  const addMetricRow = () => setMetricRows((rows) => [...rows, { key: '', value: '' }]);
  const removeMetricRow = (i: number) => setMetricRows((rows) => rows.filter((_, idx) => idx !== i));
  const updateMetricRow = (i: number, patch: Partial<{ key: string; value: string }>) =>
    setMetricRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const athletesQuery = useAthletes();
  const eventsQuery = useEvents();
  const performancesQuery = usePerformanceRecords();
  const recordPerf = useRecordPerformance();

  const athletes: Athlete[] = athletesQuery.data ?? [];

  const selectedAthlete = useMemo(
    () => athletes.find((a) => a.id === formData.athleteId),
    [athletes, formData.athleteId],
  );
  const athleteCollege = selectedAthlete?.department?.trim() ?? '';
  const athleteSport = selectedAthlete?.sport?.trim() ?? '';

  // The games this athlete actually played: published events whose competing
  // colleges include the athlete's college, in the athlete's sport. Empty until
  // an athlete is chosen — "which game" has no meaning without one. No fallback
  // to the full event list: if there's nothing here, the athlete hasn't played.
  const events: Event[] = useMemo(() => {
    if (!selectedAthlete || !athleteCollege) return [];
    const collegeLc = athleteCollege.toLowerCase();
    const sportLc = athleteSport.toLowerCase();

    return (eventsQuery.data ?? [])
      .filter((e: Event) => {
        if (!e.category) return false;
        const playedByCollege = (e.departments ?? []).some(
          (d) => d.trim().toLowerCase() === collegeLc,
        );
        if (!playedByCollege) return false;
        // Narrow to the athlete's sport when we know it; otherwise show every
        // game their college played and let the coach choose.
        return sportLc ? e.category.toLowerCase().trim() === sportLc : true;
      })
      .sort((a, b) => (a.schedule < b.schedule ? 1 : -1));
  }, [eventsQuery.data, selectedAthlete, athleteCollege, athleteSport]);

  const performances: PerformanceRecord[] = performancesQuery.data ?? [];
  const filteredPerformances = useMemo(
    () => performances.filter((p) => p.athleteName.toLowerCase().includes(search.toLowerCase())),
    [performances, search],
  );
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
      for (const row of metricRows) {
        const key = row.key.trim();
        const value = row.value.trim();
        if (!key || !value) continue;
        metrics[key] = Number.isFinite(Number(value)) && value !== '' ? Number(value) : value;
      }

      const athlete = athletes.find((a) => a.id === formData.athleteId);
      const event = events.find((e) => e.id === formData.eventId);

      await recordPerf.mutateAsync({
        athleteId: formData.athleteId,
        athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}`.trim() : '',
        eventId: formData.eventId,
        eventName: event?.name ?? '',
        sport: formData.sport || event?.category || '',
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
    });
    setMetricRows([{ key: '', value: '' }]);
  };

  const handleEventChange = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    setFormData(prev => ({
      ...prev,
      eventId,
      sport: event?.category || ''
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
            <h1 className="t-page-title">Performance Records</h1>
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
      <StatStrip
        stats={[
          { label: 'Total Records', value: performances.length },
          { label: 'This Month', value: performances.filter(p => { const recorded = new Date(p.recordedAt); const now = new Date(); return recorded.getMonth() === now.getMonth() && recorded.getFullYear() === now.getFullYear(); }).length },
          { label: 'Average Rating', value: performances.length > 0 ? (performances.reduce((sum, p) => sum + p.overallRating, 0) / performances.length).toFixed(1) : '-' },
        ]}
      />

      {/* Performance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Performance Records</CardTitle>
          <CardDescription>Latest athlete performance data</CardDescription>
          {performances.length > 0 && (
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by athlete name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
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
          ) : filteredPerformances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No records match "{search}"</div>
          ) : (
            <div className="space-y-4">
              {filteredPerformances.map(record => (
                <div key={record.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold text-lg">{record.athleteName}</h4>
                      <div className="flex min-w-0 items-center gap-2 mt-1">
                        <Badge variant="secondary" className="shrink-0">{record.sport}</Badge>
                        <span className="min-w-0 truncate text-sm text-gray-600">{record.eventName}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-2xl font-bold ${getRatingColor(record.overallRating)}`}>
                        {record.overallRating}/10
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(record.recordedAt)}</p>
                    </div>
                  </div>

                  {Object.keys(record.metrics).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      {Object.entries(record.metrics)
                        .filter(([, value]) => value !== undefined && value !== null && value !== '')
                        .map(([key, value]) => (
                          <div key={key} className="bg-gray-50 rounded p-2">
                            <p className="text-xs capitalize text-gray-600">{key.replace(/_/g, ' ')}</p>
                            <p className="font-semibold">{String(value)}</p>
                          </div>
                        ))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, athleteId: e.target.value, eventId: '', sport: '' }))}
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
                <Label htmlFor="eventId">Game played *</Label>
                <select
                  id="eventId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.eventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  disabled={!formData.athleteId}
                  required
                >
                  <option value="">
                    {formData.athleteId ? 'Select a game' : 'Select an athlete first'}
                  </option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} — {event.category} · {formatDate(event.schedule)}
                    </option>
                  ))}
                </select>
                {formData.athleteId && !athleteCollege && (
                  <p className="text-xs text-amber-600">
                    {selectedAthlete?.firstName} has no college on file — add it on their
                    profile so their games can be listed.
                  </p>
                )}
                {formData.athleteId && athleteCollege && !eventsQuery.isLoading && events.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No games found for {athleteCollege}
                    {athleteSport ? ` in ${athleteSport}` : ''} yet.
                  </p>
                )}
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Metrics (Optional)</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addMetricRow}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add metric
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Record whatever's relevant to {formData.sport} — e.g. Points, Time, Distance, Score.
                </p>
                <div className="space-y-2">
                  {metricRows.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="Metric name"
                        value={row.key}
                        onChange={(e) => updateMetricRow(i, { key: e.target.value })}
                      />
                      <Input
                        placeholder="Value"
                        value={row.value}
                        onChange={(e) => updateMetricRow(i, { value: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMetricRow(i)}
                        disabled={metricRows.length === 1}
                        className="shrink-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
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
