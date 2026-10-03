import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Skeleton } from '../../components/ui/skeleton';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getEvents, getDepartments, getVenues, getJudges, getCategories, createEvent, updateEvent, deleteEvent, bulkDeleteEvents, bulkUpdateEventStatus, unwrapList, getPageMeta, type CommitteeEmailResult } from '../../services/api';
import { CommitteeEmailDialog } from '../../components/CommitteeEmailDialog';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { makeAbbreviator } from '../../utils/departments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import {
  Calendar, Edit, Plus, Trash2, Users, QrCode, Search, Download,
  Clock, ArrowUpDown, Grid3x3, List, Archive, CheckCircle2, MapPin,
  UserCheck, Trophy, AlertTriangle, Printer, Check, ChevronLeft, ChevronRight
} from 'lucide-react';
import { printScoreSheet } from '../../utils/scoresheet';
import { divisionOf, matchesSport, sportCatalog } from '../../utils/sports';
import {
  VENUE_DAY_END, VENUE_DAY_START, minutesToTime, suggestTimes, type Booking,
} from '../../utils/venueAvailability';

/** `abbr` turns a college's full name into its short name, for sheets that print those. */
const openScoreSheet = (event: any, abbr?: (name: string) => string) => {
  const teamLabels = abbr ? (event.departments ?? []).map((d: string) => abbr(d)) : undefined;
  if (!printScoreSheet({ ...event, teamLabels })) toast.error('Allow pop-ups for this site to print the sheet.');
};
import { toast } from 'sonner';
import { Checkbox } from '../../components/ui/checkbox';
import { QRCodeModal } from '../../components/QRCodeModal';
import { CardGridSkeleton } from '../../components/ListSkeleton';

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

// Sports contested with many participants at once (a placing, not a match).
// Only used to guess a format for a sport that has no backend category row.
const RANKED_SPORT_KEYWORDS = [
  'track', 'field', 'athletic', 'swim', 'gymnast', 'cultural', 'dance', 'cheer',
  'chorale', 'pageant', 'weightlifting',
];

function guessFormat(sport: string): 'versus' | 'ranked' {
  const s = sport.toLowerCase();
  return RANKED_SPORT_KEYWORDS.some(k => s.includes(k)) ? 'ranked' : 'versus';
}

// ── Helpers ────────────────────────────────────────────────────────────────
/** Local YYYY-MM-DD (event dates are stored that way). */
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// This page cross-checks venue/judge overlaps across the whole schedule and
// computes stats over all events, so it needs every event, not one page.
// /events may still return a bare array or the new Laravel paginator shape;
// this walks every page either way.
async function fetchAllEvents(): Promise<Event[]> {
  const first = await getEvents(undefined, { page: 1, perPage: 200 });
  if (Array.isArray(first)) return first;

  const meta = getPageMeta<Event>(first);
  let items = unwrapList<Event>(first);
  if (!meta || meta.lastPage <= meta.currentPage) return items;

  const rest = await Promise.all(
    Array.from({ length: meta.lastPage - meta.currentPage }, (_, i) =>
      getEvents(undefined, { page: meta.currentPage + i + 1, perPage: 200 }),
    ),
  );
  for (const page of rest) items = items.concat(unwrapList<Event>(page));
  return items;
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
}

// Maps onto the shared Badge semantic variants (theme.css tokens) instead of
// this page inventing its own green/gray/blue — "completed" stays neutral
// (neutral) since finishing an event isn't itself a positive/negative signal.
const getStatusVariant = (s: string): 'success' | 'neutral' | 'info' =>
  s === 'ongoing' ? 'success' :
  s === 'completed' ? 'neutral' :
  'info';

const getStatusIcon = (s: string) =>
  s === 'ongoing' ? <CheckCircle2 className="h-4 w-4" /> :
  s === 'completed' ? <Archive className="h-4 w-4" /> :
  <Clock className="h-4 w-4" />;

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
};

// ── Component ──────────────────────────────────────────────────────────────
/** The parts of the event form, in order. */
const FORM_PARTS = [
  { label: 'The game', hint: 'Name the event and pick its sport.' },
  { label: 'Colleges', hint: 'Choose the colleges taking part.' },
  { label: 'When & where', hint: 'Set the date, time and venue.' },
  { label: 'Committee', hint: 'Check the details and assign who scores it.' },
] as const;

export default function AdminEventsEnhanced() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data
  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const abbr = useMemo(() => makeAbbreviator(departments), [departments]);
  const [venues, setVenues] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; format?: 'versus' | 'ranked' }[]>([]);

  // How the selected sport is contested — decides the college picker + limit.
  const formatOf = (sport: string): 'versus' | 'ranked' =>
    categories.find(c => c.name === sport)?.format ?? guessFormat(sport);

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
  // The form is filled in four parts, in the order each depends on the last:
  // the sport decides how colleges are picked, and the time decides which
  // committee members are free.
  const [part, setPart] = useState(0);
  const [emailResult, setEmailResult] = useState<{ result: CommitteeEmailResult; eventName: string } | null>(null);

  // Filters
  // Deep links: ?q= pre-fills the search (header search, dashboard), ?new=1 opens the create form.
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Sport first ('all' or 'Badminton'), then its division ('all' or the full
  // stored category, 'Badminton — W Doubles').
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  // 'all' | 'today' | 'tomorrow' | 'week' | 'past' | 'pick'
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [pickedDate, setPickedDate] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  const [stats, setStats] = useState({ total: 0, upcoming: 0, ongoing: 0, completed: 0 });
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/login'); return; }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);

    // Load core data — page cannot function without these
    try {
      const [eventsData, deptData] = await Promise.all([
        fetchAllEvents(),
        getDepartments(),
      ]);
      const normalizedEvents = (eventsData || []).map((e: any) => ({
        ...e,
        departments: e.departments || [],
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

    // Sports + their format (versus / ranked) — drives the college picker
    try {
      const catData = await getCategories();
      setCategories(catData || []);
    } catch (err) {
      console.error('Failed to load sports:', err);
    }
  };

  // ── Overlap checks (client-side) ──────────────────────────────────────
  /** The first problem with the form, and which part of it (0–3) it's in. */
  const findProblem = (data: FormData, editId?: string): { part: number; message: string } | null => {
    if (!data.name.trim()) return { part: 0, message: 'Event name is required.' };
    if (!data.category) return { part: 0, message: 'Sport type is required.' };
    {
      const picked = data.departments.filter(Boolean);
      if (formatOf(data.category) === 'versus') {
        if (new Set(picked).size !== 2) return { part: 1, message: 'Two-team sport — pick exactly two colleges.' };
      } else if (picked.length < 2) {
        return { part: 1, message: 'Pick at least two colleges.' };
      }
    }
    if (!data.schedule) return { part: 2, message: 'Schedule date is required.' };
    if (!data.startTime) return { part: 2, message: 'Start time is required.' };
    if (!data.endTime) return { part: 2, message: 'End time is required.' };
    if (timeToMinutes(data.startTime) >= timeToMinutes(data.endTime))
      return { part: 2, message: 'End time must be after start time.' };
    if (!data.venueId) return { part: 2, message: 'Venue is required.' };

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
      return { part: 2, message: `Venue already scheduled at ${formatTime(venueConflict.startTime)}–${formatTime(venueConflict.endTime)}.` };
    }

    if (data.judgeIds.length === 0) return { part: 3, message: 'Assign a committee member.' };
    if (data.judgeIds.length > 1) return { part: 3, message: 'Only one committee member can be assigned to an event.' };

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
        return { part: 3, message: `${judge?.name || 'Committee'} already assigned at ${formatTime(judgeConflict.startTime)}–${formatTime(judgeConflict.endTime)}.` };
      }
    }

    return null;
  };

  // The picked venue's bookings on the picked day (this event excluded when editing).
  const venueDay = useMemo(() => {
    if (!formData.venueId || !formData.schedule) return null;
    const bookings: Booking[] = events
      .filter(e => e.venueId === formData.venueId && e.schedule === formData.schedule && e.id !== editingEvent?.id)
      .filter(e => e.startTime && e.endTime)
      .map(e => ({ start: timeToMinutes(e.startTime), end: timeToMinutes(e.endTime), name: e.name }))
      .sort((a, b) => a.start - b.start);
    const hasTime = !!formData.startTime && !!formData.endTime;
    const start = timeToMinutes(formData.startTime);
    const end = timeToMinutes(formData.endTime);
    // The length asked for, or an hour until the times are set.
    const length = hasTime && end > start ? end - start : 60;
    const clash = hasTime && end > start ? bookings.find(b => start < b.end && b.start < end) ?? null : null;
    const suggestions = suggestTimes(bookings, length, hasTime ? start : VENUE_DAY_START);
    return {
      bookings,
      length,
      clash,
      suggestions,
      fullyBooked: suggestions.length === 0,
      venueName: venues.find((v: any) => v.id === formData.venueId)?.name ?? 'This venue',
      dayLabel: new Date(`${formData.schedule}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  }, [events, venues, formData.venueId, formData.schedule, formData.startTime, formData.endTime, editingEvent?.id]);

  const applyTimes = ([from, to]: [number, number]) => {
    setFormError(null);
    setFormData(f => ({ ...f, startTime: minutesToTime(from), endTime: minutesToTime(to) }));
  };

  /** Move on, once everything up to the current part is filled in. */
  const goNext = () => {
    const problem = findProblem(formData, editingEvent?.id);
    if (problem && problem.part <= part) {
      setPart(problem.part);
      setFormError(problem.message);
      return;
    }
    setFormError(null);
    setPart(p => Math.min(p + 1, FORM_PARTS.length - 1));
  };

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      handleOpenDialog();
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Dialog ────────────────────────────────────────────────────────────
  const handleOpenDialog = useCallback((event?: Event) => {
    setFormError(null);
    setPart(0);
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
        // One committee member per event; an older event with several keeps the first.
        judgeIds: (event.judges || []).slice(0, 1).map((j: JudgeRef) => j.id),
        departments: event.departments || [],
      });
    } else {
      setEditingEvent(null);
      setFormData(EMPTY_FORM);
    }
    setDialogOpen(true);
  }, []);

  const handleSubmit = async () => {
    setFormError(null);
    const problem = findProblem(formData, editingEvent?.id);
    if (problem) { setPart(problem.part); setFormError(problem.message); return; }

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
      // The server emails the QR code to a newly assigned committee member and
      // reports who it reached; show that in a popup so the office knows.
      const saved = editingEvent
        ? await updateEvent(editingEvent.id, cleanPayload)
        : await createEvent(cleanPayload);
      toast.success(editingEvent ? 'Event updated.' : 'Event created.');
      if (saved?.committeeEmail) {
        setEmailResult({ result: saved.committeeEmail, eventName: cleanPayload.name });
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
      const { deleted } = await bulkDeleteEvents(Array.from(selectedEvents));
      toast.success(`${deleted ?? selectedEvents.size} events deleted`);
      setSelectedEvents(new Set());
      loadData();
    } catch (e: any) { toast.error(e?.message || 'Failed to delete events'); }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!selectedEvents.size) { toast.error('No events selected'); return; }
    try {
      const { updated } = await bulkUpdateEventStatus(Array.from(selectedEvents), newStatus);
      toast.success(`${updated ?? selectedEvents.size} events updated`);
      setSelectedEvents(new Set());
      loadData();
    } catch (e: any) { toast.error(e?.message || 'Failed to update events'); }
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Sport', 'Schedule', 'Start', 'End', 'Venue', 'Status', 'Committees', 'Colleges'],
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

  // ── Filtered list ──────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    let list = [...events];
    if (searchQuery) list = list.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.category.toLowerCase().includes(searchQuery.toLowerCase()));
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    if (sportFilter !== 'all') list = list.filter(e => matchesSport(e.category, sportFilter, divisionFilter));
    if (dateFilter !== 'all') {
      const today = isoDate(new Date());
      const plus = (n: number) => isoDate(new Date(Date.now() + n * 86_400_000));
      const day = (e: Event) => String(e.schedule).slice(0, 10);
      if (dateFilter === 'today') list = list.filter(e => day(e) === today);
      else if (dateFilter === 'tomorrow') list = list.filter(e => day(e) === plus(1));
      else if (dateFilter === 'week') list = list.filter(e => day(e) >= today && day(e) <= plus(6));
      else if (dateFilter === 'past') list = list.filter(e => day(e) < today && e.status !== 'completed');
      else if (dateFilter === 'pick' && pickedDate) list = list.filter(e => day(e) === pickedDate);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'date') cmp = new Date(a.schedule).getTime() - new Date(b.schedule).getTime();
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [events, searchQuery, statusFilter, sportFilter, divisionFilter, dateFilter, pickedDate, sortBy, sortOrder]);

  const catalog = useMemo(() => sportCatalog(events.map(e => e.category)), [events]);
  const divisions = catalog.find(x => x.sport === sportFilter)?.divisions ?? [];
  const showDivision = sportFilter !== 'all' && divisions.length > 1;

  const filtersOn = statusFilter !== 'all' || sportFilter !== 'all' || dateFilter !== 'all';
  const clearFilters = () => {
    setStatusFilter('all');
    setSportFilter('all');
    setDivisionFilter('all');
    setDateFilter('all');
    setPickedDate('');
  };

  // ── Stable row callbacks (memoized cards/rows rely on referential
  // stability so a keystroke in the dialog doesn't re-render every card) ──
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleQRClick = useCallback((event: Event) => {
    setSelectedEventForQR(event);
    setQrModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((event: Event) => {
    setEventToDelete(event);
    setDeleteConfirmOpen(true);
  }, []);

  if (loading) return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Skeleton className="mb-2 h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <CardGridSkeleton count={6} />
    </div>
  );

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="t-page-title flex items-center gap-2">
              <Trophy className="h-7 w-7 text-primary" />
              Sports Event Management
            </h1>
            <p className="text-gray-500 mt-1">Create and manage sports competition events</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="secondary" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
            <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />New Event</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Events', value: stats.total, color: 'text-gray-900' },
          { label: 'Upcoming', value: stats.upcoming, color: 'text-foreground' },
          { label: 'Ongoing', value: stats.ongoing, color: 'text-foreground' },
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
                <div className="flex border rounded-md">
                  <Button variant={viewMode === 'grid' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="rounded-r-none" aria-label="Grid view"><Grid3x3 className="h-4 w-4" /></Button>
                  <Button variant={viewMode === 'list' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-l-none" aria-label="List view"><List className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <Label className="mb-1 block text-xs text-gray-500">Date</Label>
                <div className="flex gap-2">
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any date</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="tomorrow">Tomorrow</SelectItem>
                      <SelectItem value="week">Next 7 days</SelectItem>
                      <SelectItem value="past">Past, no result yet</SelectItem>
                      <SelectItem value="pick">Pick a date…</SelectItem>
                    </SelectContent>
                  </Select>
                  {dateFilter === 'pick' && (
                    <Input
                      type="date"
                      value={pickedDate}
                      onChange={e => setPickedDate(e.target.value)}
                      className="w-[9.5rem] shrink-0"
                      aria-label="Date"
                    />
                  )}
                </div>
              </div>
              <div className={showDivision ? 'grid grid-cols-2 gap-2' : ''}>
                <div className="min-w-0">
                  <Label className="mb-1 block text-xs text-gray-500">Sport type</Label>
                  <Select value={sportFilter} onValueChange={v => { setSportFilter(v); setDivisionFilter('all'); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sports</SelectItem>
                      {catalog.map(x => <SelectItem key={x.sport} value={x.sport}>{x.sport}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {showDivision && (
                  <div className="min-w-0">
                    <Label className="mb-1 block text-xs text-gray-500">Division</Label>
                    <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {sportFilter}</SelectItem>
                        {divisions.map(c => <SelectItem key={c} value={c}>{divisionOf(c) ?? c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-500">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-500">Sort by</Label>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="category">Sport</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-10 shrink-0"
                    onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                    aria-label={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {filtersOn && (
              <div className="-mt-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
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
                  <Button variant="secondary" size="sm" onClick={() => setSelectedEvents(new Set())}>Clear</Button>
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
            <EventCard
              key={event.id}
              event={event}
              selected={selectedEvents.has(event.id)}
              abbr={abbr}
              onToggleSelect={handleToggleSelect}
              onEdit={handleOpenDialog}
              onQR={handleQRClick}
              onPrint={(e: any) => openScoreSheet(e, abbr)}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredEvents.map(event => (
                <EventRow
                  key={event.id}
                  event={event}
                  selected={selectedEvents.has(event.id)}
                  abbr={abbr}
                  onToggleSelect={handleToggleSelect}
                  onEdit={handleOpenDialog}
                  onQR={handleQRClick}
                  onPrint={(e: any) => openScoreSheet(e, abbr)}
                  onDelete={handleDeleteClick}
                />
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
              {searchQuery || filtersOn
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
            <DialogDescription>
              {editingEvent
                ? 'Open any part to change it, then save.'
                : `${FORM_PARTS[part].hint} All fields are required.`}
            </DialogDescription>
          </DialogHeader>

          {/* Where you are in the form. Earlier parts (any part, when editing) can be reopened. */}
          <ol className="grid grid-cols-4 gap-2" aria-label="Event form">
            {FORM_PARTS.map((p, i) => {
              const done = i < part;
              const current = i === part;
              const reachable = !!editingEvent || i < part;
              return (
                <li key={p.label}>
                  <button
                    type="button"
                    disabled={!reachable || current}
                    onClick={() => { setFormError(null); setPart(i); }}
                    aria-current={current ? 'true' : undefined}
                    className="group flex w-full flex-col gap-1.5 text-left disabled:cursor-default"
                  >
                    <span
                      className={`h-1 w-full rounded-full transition-colors duration-200 ${
                        current || done ? 'bg-gray-900' : 'bg-gray-200'
                      }`}
                    />
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${
                          current ? 'bg-gray-900 text-white' : done ? 'bg-gray-200 text-gray-900' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      <span
                        className={`truncate font-medium ${
                          current ? 'text-gray-900' : reachable ? 'text-gray-600 group-hover:text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {p.label}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {formError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {formError}
            </div>
          )}

          <div key={part} className="chart-rise min-h-[14rem] space-y-5">
            {part === 0 && (
              <>
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
                <Select
                  value={formData.category}
                  onValueChange={v => setFormData(f => ({
                    ...f,
                    category: v,
                    // Switching to a two-team sport can't keep 3+ colleges.
                    departments: formatOf(v) === 'versus' ? f.departments.filter(Boolean).slice(0, 2) : f.departments,
                  }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select sport" /></SelectTrigger>
                  <SelectContent>
                    {(categories.length ? categories.map(c => c.name) : SPORTS).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
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

              </>
            )}

            {part === 1 && (
              <>
            {/* Colleges — two-team sports pick Home/Away, ranked sports pick a list */}
            {formatOf(formData.category) === 'versus' ? (
              <div>
                <Label>
                  Colleges <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500 font-normal">one game — two colleges</span>
                </Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {(['home', 'away'] as const).map((side, idx) => {
                    const value = formData.departments[idx] || '';
                    const other = formData.departments[idx === 0 ? 1 : 0];
                    return (
                      <div key={side}>
                        <p className="text-xs font-medium text-gray-500 mb-1">{side === 'home' ? 'Home' : 'Away'}</p>
                        <Select
                          value={value}
                          onValueChange={v => setFormData(f => {
                            const next = [f.departments[0] || '', f.departments[1] || ''];
                            next[idx] = v;
                            return { ...f, departments: next.filter(Boolean) };
                          })}
                        >
                          <SelectTrigger><SelectValue placeholder="Select college" /></SelectTrigger>
                          <SelectContent>
                            {departments
                              .filter((d: any) => d.name !== other)
                              .map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Running several colleges through this sport? Generate the games in{' '}
                  <span className="font-medium text-gray-700">Bracketing</span>.
                </p>
              </div>
            ) : (
              <div>
                <Label>
                  Participating Colleges <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500 font-normal">({formData.departments.length} selected)</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-72 overflow-y-auto border rounded p-3 bg-gray-50">
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
            )}
              </>
            )}

            {part === 2 && (
              <>
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

            {/* Is the venue free then? Suggest times that are, or say it's full. */}
            {venueDay && (() => {
              const hours = (m: number) => `${Math.floor(m / 60) ? `${Math.floor(m / 60)}h` : ''}${m % 60 ? ` ${m % 60}m` : ''}`.trim();
              const range = ([a, b]: [number, number]) => `${formatTime(minutesToTime(a))}–${formatTime(minutesToTime(b))}`;
              if (venueDay.fullyBooked) {
                return (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="status">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      <span className="font-semibold">{venueDay.venueName} is fully booked on {venueDay.dayLabel}.</span>{' '}
                      There's no free {hours(venueDay.length)} between {formatTime(minutesToTime(VENUE_DAY_START))} and{' '}
                      {formatTime(minutesToTime(VENUE_DAY_END))}. Pick another day or venue.
                    </p>
                  </div>
                );
              }
              if (venueDay.clash) {
                return (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                    <p className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="font-semibold">{venueDay.venueName} is already booked {range([venueDay.clash.start, venueDay.clash.end])}</span>{' '}
                        on {venueDay.dayLabel} ({venueDay.clash.name}).
                      </span>
                    </p>
                    <p className="mt-2 text-xs font-medium text-amber-900/80">Free for {hours(venueDay.length)}:</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {venueDay.suggestions.map(sug => (
                        <button
                          key={sug[0]}
                          type="button"
                          onClick={() => applyTimes(sug)}
                          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-900 transition-colors hover:border-gray-900"
                        >
                          {range(sug)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              if (venueDay.bookings.length > 0) {
                return (
                  <p className="text-xs text-gray-500">
                    Already booked on {venueDay.dayLabel}:{' '}
                    {venueDay.bookings.slice(0, 3).map(b => range([b.start, b.end])).join(', ')}
                    {venueDay.bookings.length > 3 ? ` and ${venueDay.bookings.length - 3} more` : ''}.
                  </p>
                );
              }
              return <p className="text-xs text-gray-500">{venueDay.venueName} is free all day on {venueDay.dayLabel}.</p>;
            })()}

              </>
            )}

            {part === 3 && (
              <>
                {/* What this event is, before it's saved */}
                <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border bg-gray-50 p-3 text-sm">
                  <dt className="text-gray-500">Event</dt>
                  <dd className="truncate font-medium text-gray-900">{formData.name || '—'}</dd>
                  <dt className="text-gray-500">Sport</dt>
                  <dd className="truncate text-gray-900">{formData.category || '—'}</dd>
                  <dt className="text-gray-500">Colleges</dt>
                  <dd className="truncate text-gray-900">
                    {formData.departments
                      .filter(Boolean)
                      .map(d => departments.find((x: any) => x.name === d)?.abbreviation || d)
                      .join(formatOf(formData.category) === 'versus' ? ' vs ' : ', ') || '—'}
                  </dd>
                  <dt className="text-gray-500">When</dt>
                  <dd className="truncate text-gray-900">
                    {formData.schedule
                      ? `${new Date(`${formData.schedule}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${formatTime(formData.startTime)}–${formatTime(formData.endTime)}`
                      : '—'}
                  </dd>
                  <dt className="text-gray-500">Venue</dt>
                  <dd className="truncate text-gray-900">{venues.find((v: any) => v.id === formData.venueId)?.name || formData.venueName || '—'}</dd>
                </dl>
            {/* Committee — one member scores each event */}
            <div>
              <Label>
                Assign Committee <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500 font-normal">one member per event</span>
              </Label>
              {judges.length === 0 ? (
                <p className="text-sm text-amber-600 mt-1 p-2 bg-amber-50 rounded border border-amber-200">
                  No judge accounts found. Register judge users first.
                </p>
              ) : (
                <RadioGroup
                  value={formData.judgeIds[0] ?? ''}
                  onValueChange={id => setFormData(f => ({ ...f, judgeIds: [id] }))}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-72 overflow-y-auto"
                >
                  {judges.map((j: any) => {
                    const on = formData.judgeIds[0] === j.id;
                    return (
                      <label
                        key={j.id}
                        htmlFor={`judge-${j.id}`}
                        className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                          on ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <RadioGroupItem id={`judge-${j.id}`} value={j.id} className="border-gray-400" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">{j.name}</span>
                          <span className="block truncate text-xs text-gray-500">{j.email}</span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            </div>

              </>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            {part === 0 ? (
              <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            ) : (
              <Button variant="secondary" onClick={() => { setFormError(null); setPart(p => p - 1); }} disabled={submitting}>
                <ChevronLeft className="mr-1 h-4 w-4" />Back
              </Button>
            )}
            <div className="flex items-center gap-2">
              {editingEvent && part < FORM_PARTS.length - 1 && (
                <Button variant="ghost" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save now'}
                </Button>
              )}
              {part < FORM_PARTS.length - 1 ? (
                <Button onClick={goNext} disabled={submitting}>
                  Continue<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>"{abbr(eventToDelete?.name ?? '')}"</strong>? All scores will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommitteeEmailDialog
        result={emailResult?.result ?? null}
        eventName={emailResult?.eventName}
        onClose={() => setEmailResult(null)}
      />

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

// ── Memoized row/card components ──────────────────────────────────────────
// The events list can run into the dozens once a season is fully scheduled,
// and every keystroke in the create/edit dialog re-renders this page. These
// are wrapped in React.memo, and the parent passes stable (useCallback)
// handlers, so unrelated cards/rows skip re-rendering.
interface EventRowProps {
  event: Event;
  selected: boolean;
  abbr: (name: string) => string;
  onToggleSelect: (id: string) => void;
  onEdit: (event: Event) => void;
  onQR: (event: Event) => void;
  onPrint: (event: Event) => void;
  onDelete: (event: Event) => void;
}

const EventCard = memo(function EventCard({
  event, selected, abbr, onToggleSelect, onEdit, onQR, onPrint, onDelete,
}: EventRowProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start gap-2">
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(event.id)} />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base leading-tight" title={event.name}>{abbr(event.name)}</CardTitle>
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
            {(event.judges || []).length} committee{(event.judges || []).length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="h-4 w-4 shrink-0" />
            {(event.departments || []).length} dept{(event.departments || []).length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(event.status)}
            <Badge variant={getStatusVariant(event.status)}>{event.status}</Badge>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => onEdit(event)}>
              <Edit className="h-3 w-3 mr-1" />Edit
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => onQR(event)}>
              <QrCode className="h-3 w-3 mr-1" />QR
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => onPrint(event)} title="Print score sheet">
              <Printer className="h-3 w-3 mr-1" />Sheet
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="w-full text-red-600 hover:text-red-700" onClick={() => onDelete(event)}>
            <Trash2 className="h-3 w-3 mr-1" />Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

const EventRow = memo(function EventRow({
  event, selected, abbr, onToggleSelect, onEdit, onQR, onPrint, onDelete,
}: EventRowProps) {
  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex items-center gap-4">
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(event.id)} />
        <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
          <div className="md:col-span-2">
            <p className="font-semibold" title={event.name}>{abbr(event.name)}</p>
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
            <p className="text-gray-500">Committees / Depts</p>
            <p>{(event.judges || []).length} / {(event.departments || []).length}</p>
          </div>
          <div className="flex items-center">
            <Badge variant={getStatusVariant(event.status)}>{event.status}</Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(event)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => onQR(event)}><QrCode className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => onPrint(event)} title="Print score sheet"><Printer className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(event)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
});
