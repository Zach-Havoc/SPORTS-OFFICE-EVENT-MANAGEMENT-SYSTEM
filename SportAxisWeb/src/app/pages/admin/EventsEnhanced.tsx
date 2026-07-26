import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getEvents, getDepartments, getVenues, getJudges, createEvent, updateEvent, deleteEvent } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import {
  Calendar, Edit, Plus, Trash2, Users, QrCode, Search, Filter, Download,
  Clock, ArrowUpDown, Grid3x3, List, Archive, CheckCircle2, AlertCircle, MapPin,
  UserCheck, Trophy, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '../../components/ui/checkbox';
import { QRCodeModal } from '../../components/QRCodeModal';
import Loading from '../../components/Loading';

// ── Sports-only category list ──────────────────────────────────────────────
const SPORTS = [
  'Basketball',
  'Volleyball',
  'Badminton',
  'Swimming',
  'Track & Field',
  'Table Tennis',
  'Football',
  'Tennis',
  'Sepak Takraw',
  'Arnis',
  'Softball',
  'Baseball',
  'Chess',
  'Gymnastics',
  'Boxing',
  'Weightlifting',
];

// ── Helpers ────────────────────────────────────────────────────────────────
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  if (!s1 || !e1 || !s2 || !e2) return false;
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(s2) < timeToMinutes(e1);
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface JudgeRef { id: string; name: string; email: string; }

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  venueId: string;
  venueName: string;
  judges: JudgeRef[];
  departments: string[];
  criteria: Array<{ name: string; weight: number }>;
  qrToken?: string;
}

interface FormData {
  name: string;
  category: string;
  schedule: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  venueId: string;
  venueName: string;
  judgeIds: string[];
  departments: string[];
  criteria: Array<{ name: string; weight: number }>;
}

const EMPTY_FORM: FormData = {
  name: '',
  category: '',
  schedule: '',
  startTime: '',
  endTime: '',
  status: 'upcoming',
  venueId: '',
  venueName: '',
  judgeIds: [],
  departments: [],
  criteria: [{ name: '', weight: 100 }],
};

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminEventsEnhanced() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data
  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedEventForQR, setSelectedEventForQR] = useState<Event | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  const [stats, setStats] = useState({ total: 0, upcoming: 0, ongoing: 0, completed: 0 });
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/login'); return; }
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);

    // Load core data — page cannot function without these
    try {
      const [eventsData, deptData] = await Promise.all([getEvents(), getDepartments()]);
      const normalizedEvents = (eventsData || []).map((e: any) => ({
        ...e,
        departments: e.departments || [],
        criteria: e.criteria || [],
        judges: e.judges || [],
      }));
      setEvents(normalizedEvents);
      setDepartments(deptData || []);
      setStats({
        total: normalizedEvents.length,
        upcoming: normalizedEvents.filter((e: Event) => e.status === 'upcoming').length,
        ongoing: normalizedEvents.filter((e: Event) => e.status === 'ongoing').length,
        completed: normalizedEvents.filter((e: Event) => e.status === 'completed').length,
      });
    } catch (err) {
      toast.error('Failed to load events data');
    } finally {
      setLoading(false);
    }

    // Load venues independently — show ALL venues so admin can pick any
    try {
      const venueData = await getVenues();
      setVenues(venueData || []);
    } catch (err) {
      console.error('Failed to load venues:', err);
      toast.error('Could not load venues — check your connection');
    }

    // Load judges independently so it doesn't block the main event load
    try {
      const judgeData = await getJudges();
      setJudges(judgeData || []);
    } catch (err) {
      console.error('Failed to load judges:', err);
      toast.error('Could not load judge accounts');
    }
  };

  // ── Overlap checks (client-side) ──────────────────────────────────────
  const validateForm = (data: FormData, editId?: string): string | null => {
    if (!data.name.trim()) return 'Event name is required.';
    if (!data.category) return 'Sport type is required.';
    if (!data.schedule) return 'Schedule date is required.';
    if (!data.startTime) return 'Start time is required.';
    if (!data.endTime) return 'End time is required.';
    if (timeToMinutes(data.startTime) >= timeToMinutes(data.endTime))
      return 'End time must be after start time.';
    if (!data.venueId) return 'Venue is required.';
    if (data.judgeIds.length === 0) return 'At least one judge must be assigned.';
    if (data.departments.length === 0) return 'At least one department must participate.';
    if (data.criteria.length === 0) return 'At least one scoring criterion is required.';
    for (const c of data.criteria) {
      if (!c.name.trim()) return 'All criteria must have a name.';
      if (!c.weight || c.weight <= 0) return 'All criteria weights must be greater than 0.';
    }

    // Venue overlap
    const venueConflict = events.find(e => {
      if (editId && e.id === editId) return false;
      return (
        e.venueId === data.venueId &&
        e.schedule === data.schedule &&
        timesOverlap(data.startTime, data.endTime, e.startTime, e.endTime)
      );
    });
    if (venueConflict) {
      return `Venue conflict: "${venueConflict.name}" is already at this venue on ${venueConflict.schedule} from ${formatTime(venueConflict.startTime)} to ${formatTime(venueConflict.endTime)}.`;
    }

    // Judge overlap
    for (const judgeId of data.judgeIds) {
      const judge = judges.find(j => j.id === judgeId);
      const judgeConflict = events.find(e => {
        if (editId && e.id === editId) return false;
        return (
          e.schedule === data.schedule &&
          (e.judges || []).some((j: JudgeRef) => j.id === judgeId) &&
          timesOverlap(data.startTime, data.endTime, e.startTime, e.endTime)
        );
      });
      if (judgeConflict) {
        return `Judge conflict: "${judge?.name || judgeId}" is already assigned to "${judgeConflict.name}" from ${formatTime(judgeConflict.startTime)} to ${formatTime(judgeConflict.endTime)}.`;
      }
    }

    return null;
  };

  // ── Dialog ────────────────────────────────────────────────────────────
  const handleOpenDialog = (event?: Event) => {
    setFormError(null);
    if (event) {
      setEditingEvent(event);
      setFormData({
        name: event.name,
        category: event.category,
        schedule: event.schedule,
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        status: event.status,
        venueId: event.venueId || '',
        venueName: event.venueName || '',
        judgeIds: (event.judges || []).map((j: JudgeRef) => j.id),
        departments: event.departments || [],
        criteria: event.criteria?.length ? event.criteria : [{ name: '', weight: 100 }],
      });
    } else {
      setEditingEvent(null);
      setFormData(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    const error = validateForm(formData, editingEvent?.id);
    if (error) { setFormError(error); return; }

    const selectedJudges = judges
      .filter(j => formData.judgeIds.includes(j.id))
      .map(j => ({ id: j.id, name: j.name, email: j.email }));

    const selectedVenue = venues.find(v => v.id === formData.venueId);

    const payload = {
      ...formData,
      venueName: selectedVenue?.name || formData.venueName,
      judges: selectedJudges,
    };
    // Remove judgeIds from payload (backend uses judges array)
    const { judgeIds: _, ...cleanPayload } = payload;

    try {
      setSubmitting(true);
      if (editingEvent) {
        await updateEvent(editingEvent.id, cleanPayload);
        toast.success('Event updated successfully');
      } else {
        await createEvent(cleanPayload);
        toast.success('Event created successfully');
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save event';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      await deleteEvent(eventToDelete.id);
      toast.success('Event deleted');
      setDeleteConfirmOpen(false);
      setEventToDelete(null);
      loadData();
    } catch {
      toast.error('Failed to delete event');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedEvents.size) { toast.error('No events selected'); return; }
    try {
      await Promise.all(Array.from(selectedEvents).map(id => deleteEvent(id)));
      toast.success(`${selectedEvents.size} events deleted`);
      setSelectedEvents(new Set());
      loadData();
    } catch { toast.error('Failed to delete some events'); }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!selectedEvents.size) { toast.error('No events selected'); return; }
    try {
      await Promise.all(
        Array.from(selectedEvents).map(id => {
          const ev = events.find(e => e.id === id);
          return ev ? updateEvent(id, { ...ev, status: newStatus as any }) : null;
        })
      );
      toast.success(`${selectedEvents.size} events updated`);
      setSelectedEvents(new Set());
      loadData();
    } catch { toast.error('Failed to update events'); }
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Sport', 'Schedule', 'Start', 'End', 'Venue', 'Status', 'Judges', 'Departments'],
      ...filteredEvents.map(e => [
        e.name, e.category, e.schedule, e.startTime, e.endTime,
        e.venueName,
        e.status,
        (e.judges || []).map((j: JudgeRef) => j.name).join('; '),
        (e.departments || []).join('; '),
      ])
    ].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('Exported');
  };

  // ── Criteria helpers ──────────────────────────────────────────────────
  const totalWeight = formData.criteria.reduce((s, c) => s + (c.weight || 0), 0);

  // ── Filtered list ──────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    let list = [...events];
    if (searchQuery) list = list.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.category.toLowerCase().includes(searchQuery.toLowerCase()));
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    if (sportFilter !== 'all') list = list.filter(e => e.category === sportFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'date') cmp = new Date(a.schedule).getTime() - new Date(b.schedule).getTime();
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [events, searchQuery, statusFilter, sportFilter, sortBy, sortOrder]);

  const getStatusColor = (s: string) =>
    s === 'ongoing' ? 'bg-green-100 text-green-800' :
    s === 'completed' ? 'bg-gray-100 text-gray-800' :
    'bg-blue-100 text-blue-800';

  const getStatusIcon = (s: string) =>
    s === 'ongoing' ? <CheckCircle2 className="h-4 w-4" /> :
    s === 'completed' ? <Archive className="h-4 w-4" /> :
    <Clock className="h-4 w-4" />;

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Loading fullScreen={false} message="Loading events..." />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="h-7 w-7 text-primary" />
              Sports Event Management
            </h1>
            <p className="text-gray-500 mt-1">Create and manage sports competition events</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
            <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />New Event</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Events', value: stats.total, color: 'text-gray-900' },
          { label: 'Upcoming', value: stats.upcoming, color: 'text-blue-600' },
          { label: 'Ongoing', value: stats.ongoing, color: 'text-green-600' },
          { label: 'Completed', value: stats.completed, color: 'text-gray-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">{s.label}</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search by name or sport..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4 mr-2" />Filters
                </Button>
                <div className="flex border rounded-md">
                  <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="rounded-r-none"><Grid3x3 className="h-4 w-4" /></Button>
                  <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-l-none"><List className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-md">
                <div>
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sport</Label>
                  <Select value={sportFilter} onValueChange={setSportFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sort By</Label>
                  <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="category">Sport</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedEvents.size > 0 && (
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-md border border-blue-200">
                <span className="text-sm font-medium text-blue-900">{selectedEvents.size} selected</span>
                <div className="flex gap-2 ml-auto">
                  <Select onValueChange={handleBulkStatusChange}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Change status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Set Upcoming</SelectItem>
                      <SelectItem value="ongoing">Set Ongoing</SelectItem>
                      <SelectItem value="completed">Set Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedEvents(new Set())}>Clear</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-600">Showing {filteredEvents.length} of {events.length} events</p>
        {filteredEvents.length > 0 && (
          <div onClick={() => setSelectedEvents(selectedEvents.size === filteredEvents.length ? new Set() : new Set(filteredEvents.map(e => e.id)))}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer">
            <Checkbox checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0} />
            Select All
          </div>
        )}
      </div>

      {/* Event Cards */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map(event => (
            <Card key={event.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-2">
                  <Checkbox checked={selectedEvents.has(event.id)} onCheckedChange={() => {
                    const n = new Set(selectedEvents);
                    n.has(event.id) ? n.delete(event.id) : n.add(event.id);
                    setSelectedEvents(n);
                  }} />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight">{event.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Trophy className="h-3 w-3" />{event.category}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4 shrink-0" />
                    {new Date(event.schedule).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4 shrink-0" />
                    {formatTime(event.startTime)} – {formatTime(event.endTime)}
                  </div>
                  {event.venueName && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {event.venueName}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <UserCheck className="h-4 w-4 shrink-0" />
                    {(event.judges || []).length} judge{(event.judges || []).length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4 shrink-0" />
                    {(event.departments || []).length} dept{(event.departments || []).length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(event.status)}
                    <Badge className={getStatusColor(event.status)}>{event.status}</Badge>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenDialog(event)}>
                      <Edit className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedEventForQR(event); setQrModalOpen(true); }}>
                      <QrCode className="h-3 w-3 mr-1" />QR
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-red-600 hover:text-red-700" onClick={() => { setEventToDelete(event); setDeleteConfirmOpen(true); }}>
                    <Trash2 className="h-3 w-3 mr-1" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredEvents.map(event => (
                <div key={event.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <Checkbox checked={selectedEvents.has(event.id)} onCheckedChange={() => {
                      const n = new Set(selectedEvents);
                      n.has(event.id) ? n.delete(event.id) : n.add(event.id);
                      setSelectedEvents(n);
                    }} />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
                      <div className="md:col-span-2">
                        <p className="font-semibold">{event.name}</p>
                        <p className="text-gray-500">{event.category}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date & Time</p>
                        <p>{new Date(event.schedule).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">{formatTime(event.startTime)} – {formatTime(event.endTime)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Venue</p>
                        <p>{event.venueName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Judges / Depts</p>
                        <p>{(event.judges || []).length} / {(event.departments || []).length}</p>
                      </div>
                      <div className="flex items-center">
                        <Badge className={getStatusColor(event.status)}>{event.status}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(event)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEventForQR(event); setQrModalOpen(true); }}><QrCode className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => { setEventToDelete(event); setDeleteConfirmOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredEvents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || statusFilter !== 'all' || sportFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first sports event'}
            </p>
            <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Create Event</Button>
          </CardContent>
        </Card>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!submitting) setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Sports Event'}</DialogTitle>
            <DialogDescription>All fields are required.</DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {formError}
            </div>
          )}

          <div className="space-y-5">
            {/* Name */}
            <div>
              <Label>Event Name <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Men's 3x3 Basketball"
              />
            </div>

            {/* Sport + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sport Type <span className="text-red-500">*</span></Label>
                <Select value={formData.category} onValueChange={v => setFormData(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select sport" /></SelectTrigger>
                  <SelectContent>
                    {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status <span className="text-red-500">*</span></Label>
                <Select value={formData.status} onValueChange={(v: any) => setFormData(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date + Times */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={formData.schedule} onChange={e => setFormData(f => ({ ...f, schedule: e.target.value }))} />
              </div>
              <div>
                <Label>Start Time <span className="text-red-500">*</span></Label>
                <Input type="time" value={formData.startTime} onChange={e => setFormData(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>End Time <span className="text-red-500">*</span></Label>
                <Input type="time" value={formData.endTime} onChange={e => setFormData(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>

            {/* Venue */}
            <div>
              <Label>Venue <span className="text-red-500">*</span></Label>
              {venues.length === 0 ? (
                <p className="text-sm text-amber-600 mt-1 p-2 bg-amber-50 rounded border border-amber-200">
                  No available venues. Please add a venue in Venue Management first.
                </p>
              ) : (
                <Select value={formData.venueId} onValueChange={v => setFormData(f => ({ ...f, venueId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    {venues.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.location ? `— ${v.location}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Judges */}
            <div>
              <Label>
                Assign Judges <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500 font-normal">({formData.judgeIds.length} selected)</span>
              </Label>
              {judges.length === 0 ? (
                <p className="text-sm text-amber-600 mt-1 p-2 bg-amber-50 rounded border border-amber-200">
                  No judge accounts found. Register judge users first.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-36 overflow-y-auto border rounded p-3 bg-gray-50">
                  {judges.map((j: any) => (
                    <div key={j.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`judge-${j.id}`}
                        checked={formData.judgeIds.includes(j.id)}
                        onCheckedChange={checked => {
                          setFormData(f => ({
                            ...f,
                            judgeIds: checked
                              ? [...f.judgeIds, j.id]
                              : f.judgeIds.filter(id => id !== j.id),
                          }));
                        }}
                      />
                      <label htmlFor={`judge-${j.id}`} className="text-sm cursor-pointer">
                        <span className="font-medium">{j.name}</span>
                        <span className="text-gray-500 ml-1 text-xs">{j.email}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Departments */}
            <div>
              <Label>
                Participating Departments <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500 font-normal">({formData.departments.length} selected)</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto border rounded p-3 bg-gray-50">
                {departments.map((dept: any) => (
                  <div key={dept.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`dept-${dept.id}`}
                      checked={formData.departments.includes(dept.name)}
                      onCheckedChange={checked => {
                        setFormData(f => ({
                          ...f,
                          departments: checked
                            ? [...f.departments, dept.name]
                            : f.departments.filter(d => d !== dept.name),
                        }));
                      }}
                    />
                    <label htmlFor={`dept-${dept.id}`} className="text-sm cursor-pointer">{dept.name}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Criteria */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>
                  Scoring Criteria <span className="text-red-500">*</span>
                </Label>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${totalWeight === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  Total: {totalWeight}%
                </span>
              </div>
              <div className="space-y-2">
                {formData.criteria.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Criterion name (e.g. Accuracy)"
                      value={c.name}
                      onChange={e => {
                        const updated = [...formData.criteria];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setFormData(f => ({ ...f, criteria: updated }));
                      }}
                      className="flex-1"
                    />
                    <div className="relative w-28">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="Weight"
                        value={c.weight || ''}
                        onChange={e => {
                          const updated = [...formData.criteria];
                          updated[i] = { ...updated[i], weight: Number(e.target.value) };
                          setFormData(f => ({ ...f, criteria: updated }));
                        }}
                        className="pr-7"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    {formData.criteria.length > 1 && (
                      <Button variant="ghost" size="sm" className="px-2" onClick={() => setFormData(f => ({ ...f, criteria: f.criteria.filter((_, idx) => idx !== i) }))}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFormData(f => ({ ...f, criteria: [...f.criteria, { name: '', weight: 0 }] }))}>
                  <Plus className="h-4 w-4 mr-2" />Add Criterion
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>"{eventToDelete?.name}"</strong>? All scores will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      {selectedEventForQR && selectedEventForQR.qrToken && (
        <QRCodeModal
          open={qrModalOpen}
          onOpenChange={open => { setQrModalOpen(open); if (!open) setSelectedEventForQR(null); }}
          eventId={selectedEventForQR.id}
          eventName={selectedEventForQR.name}
          qrToken={selectedEventForQR.qrToken}
        />
      )}
    </div>
  );
}
