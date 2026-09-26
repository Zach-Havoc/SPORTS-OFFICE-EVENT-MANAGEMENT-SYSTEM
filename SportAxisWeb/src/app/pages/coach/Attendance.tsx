import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  Users, Search, AlertTriangle,
  CalendarDays, Trash2, Plus, Check, Loader2, Pencil, Clock, MapPin, Repeat,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAthletes, useAttendanceRecords, useAttendanceSessions, useAttendanceSession,
  useCreateAttendanceSession, useUpdateAttendanceSession, useDeleteAttendanceSession,
  useSaveSessionRecords, useCreateRecurringSessions,
} from '../../hooks/api';
import type { AttendanceSession } from '../../services/api';
import { RefreshStatus } from '../../components/RefreshStatus';

type Status = 'present' | 'absent' | 'late' | 'excused';

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  department: string;
}

const today = () => new Date().toISOString().split('T')[0];
const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Present + late count as attended; excused is neutral (out of the denominator). */
function rateOf(recs: { status: Status }[]) {
  const attended = recs.filter((r) => r.status === 'present' || r.status === 'late').length;
  const denom = attended + recs.filter((r) => r.status === 'absent').length;
  return { attended, denom, pct: denom ? attended / denom : null };
}

/** "16:00" → "4:00 PM". */
const fmtTime = (t: string | null | undefined) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const timeRange = (s: { startTime: string | null; endTime: string | null }) =>
  s.startTime ? `${fmtTime(s.startTime)}${s.endTime ? ` – ${fmtTime(s.endTime)}` : ''}` : '';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

// ── Page ────────────────────────────────────────────────────────────────────

export default function CoachAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const sessionsQ = useAttendanceSessions();
  const athletesQ = useAthletes();
  const recordsQ = useAttendanceRecords();
  const createMut = useCreateAttendanceSession();
  const recurringMut = useCreateRecurringSessions();
  const deleteMut = useDeleteAttendanceSession();

  const sessions = sessionsQ.data ?? [];
  const athletes = (athletesQ.data ?? []) as Athlete[];

  const historyByAthlete = useMemo(() => {
    const m = new Map<string, { status: Status }[]>();
    for (const r of (recordsQ.data ?? []) as { athleteId: string; status: Status }[]) {
      m.set(r.athleteId, [...(m.get(r.athleteId) ?? []), r]);
    }
    return m;
  }, [recordsQ.data]);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AttendanceSession | null>(null);

  const openSession = sessions.find((s) => s.id === openId) ?? null;

  const timing = { startTime: startTime || null, endTime: endTime || null, venueName: venue.trim() || null };
  const resetForm = () => {
    setTitle(''); setDate(today()); setStartTime(''); setEndTime(''); setVenue('');
    setRepeat(false); setWeekdays([]); setUntil('');
  };

  const create = () => {
    if (!title.trim()) return toast.error('Give the session a title.');
    if (startTime && endTime && endTime <= startTime) return toast.error('End time must be after the start time.');

    if (repeat) {
      if (!weekdays.length) return toast.error('Pick at least one day of the week.');
      if (!until || until < date) return toast.error('Pick an end date on or after the start date.');
      recurringMut.mutate(
        { title: title.trim(), from: date, to: until, weekdays, ...timing },
        {
          onSuccess: ({ created, skipped }) => {
            toast.success(
              `${created.length} training session${created.length === 1 ? '' : 's'} scheduled. Your athletes were notified.`,
              skipped.length
                ? { description: `Skipped ${skipped.length}: ${skipped.map((x) => `${x.date} — ${x.reason}`).join(' ')}`, duration: 10000 }
                : undefined,
            );
            resetForm();
          },
          onError: (e: any) => toast.error(e?.message || 'Could not create the schedule.'),
        },
      );
      return;
    }

    createMut.mutate(
      { title: title.trim(), date, ...timing },
      {
        onSuccess: (s) => {
          resetForm();
          setOpenId(s.id);
        },
        onError: (e: any) => toast.error(e?.message || 'Could not create the session.'),
      },
    );
  };
  const busy = createMut.isPending || recurringMut.isPending;

  const loading = sessionsQ.isLoading || athletesQ.isLoading;

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="t-page-title">Attendance</h1>
        <RefreshStatus
          fetching={(sessionsQ.isFetching || athletesQ.isFetching) && !loading}
          error={sessionsQ.isRefetchError || athletesQ.isRefetchError}
          onRetry={() => { sessionsQ.refetch(); athletesQ.refetch(); }}
        />
      </div>

      {/* New session */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Schedule training</CardTitle>
          <CardDescription>
            Add one session, or repeat it weekly. Your athletes are notified and see it on their schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1.5fr]">
            <label className="space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-medium text-gray-600">Title</span>
              <input
                className={inputCls}
                placeholder="e.g. Team training"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">{repeat ? 'Starts' : 'Date'}</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">From</span>
              <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">To</span>
              <input type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-600">Venue</span>
              <input className={inputCls} placeholder="e.g. Main Gym" value={venue} maxLength={120} onChange={(e) => setVenue(e.target.value)} />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center">
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
              <input type="checkbox" className="h-4 w-4 accent-gray-900" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              <Repeat className="h-4 w-4 text-gray-500" />
              Repeat weekly
            </label>
            {repeat && (
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d, i) => {
                    const on = weekdays.includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== i) : [...w, i]))}
                        className={`h-8 w-11 rounded-md border text-xs font-medium transition-colors ${
                          on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  until
                  <input type="date" className={`${inputCls} w-auto`} value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {repeat ? 'Days when the venue is booked for a game are skipped and listed.' : 'Leave time and venue blank if they are not set yet.'}
            </p>
            <Button onClick={create} disabled={busy}>
              <Plus className="h-4 w-4 mr-1" />
              {busy ? 'Scheduling…' : repeat ? 'Create schedule' : 'Create session'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <CalendarDays className="h-8 w-8 mx-auto text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No sessions yet</p>
          <p className="mt-1 text-sm text-gray-500">Create one above to start taking attendance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s) => {
            const pct = s.rosterCount ? Math.round((s.markedCount / s.rosterCount) * 100) : 0;
            return (
              <Card key={s.id} className="cursor-pointer transition-colors hover:border-red-200" onClick={() => setOpenId(s.id)}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {fmtDate(s.date)}
                      </p>
                      {(s.startTime || s.venueName) && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          {s.startTime && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{timeRange(s)}</span>}
                          {s.venueName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.venueName}</span>}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setToDelete(s); }}
                      className="rounded p-1 text-destructive/60 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-gray-500">{s.markedCount} / {s.rosterCount} marked</span>
                      {s.complete ? (
                        <span className="inline-flex items-center gap-1 font-medium text-green-700">
                          <Check className="h-3.5 w-3.5" /> Complete
                        </span>
                      ) : null}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${s.complete ? 'bg-green-500' : 'bg-red-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {openSession && (
        <SessionDialog
          key={openSession.id}
          session={openSession}
          athletes={athletes}
          history={historyByAthlete}
          onClose={() => setOpenId(null)}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the session and all attendance recorded in it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toDelete) return;
                deleteMut.mutate(toDelete.id, {
                  onSuccess: () => { if (openId === toDelete.id) setOpenId(null); setToDelete(null); },
                  onError: (e: any) => toast.error(e?.message || 'Could not delete.'),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Session dialog ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
  { value: 'absent', label: 'Absent' },
];
const STATUS_TEXT: Record<Status, string> = {
  present: 'text-green-700',
  late: 'text-yellow-700',
  excused: 'text-blue-700',
  absent: 'text-red-700',
};

function SessionDialog({
  session,
  athletes,
  history,
  onClose,
}: {
  session: AttendanceSession;
  athletes: Athlete[];
  history: Map<string, { status: Status }[]>;
  onClose: () => void;
}) {
  const detailQ = useAttendanceSession(session.id);
  const saveMut = useSaveSessionRecords();
  const updateMut = useUpdateAttendanceSession();

  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = useRef<Set<string>>(new Set());

  const [editMeta, setEditMeta] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [date, setDate] = useState(session.date);
  const [startTime, setStartTime] = useState(session.startTime ?? '');
  const [endTime, setEndTime] = useState(session.endTime ?? '');
  const [venue, setVenue] = useState(session.venueName ?? '');

  // Hydrate from what's saved for this session.
  useEffect(() => {
    const recs = (detailQ.data?.records ?? []) as { athleteId: string; status: Status; notes: string | null }[];
    const a: Record<string, Status> = {};
    const n: Record<string, string> = {};
    for (const r of recs) {
      a[r.athleteId] = r.status;
      if (r.notes) n[r.athleteId] = r.notes;
    }
    setAttendance(a);
    setNotes(n);
    dirty.current.clear();
  }, [detailQ.data]);

  // Debounced auto-save of whatever changed.
  useEffect(() => {
    if (dirty.current.size === 0) return;
    const t = setTimeout(() => {
      const ids = [...dirty.current];
      dirty.current.clear();
      const records = ids
        .filter((id) => attendance[id])
        .map((id) => ({ athleteId: id, status: attendance[id], notes: notes[id] || '' }));
      if (!records.length) return;
      setSaveState('saving');
      saveMut.mutate(
        { id: session.id, records },
        {
          onSuccess: () => setSaveState('saved'),
          onError: () => { setSaveState('error'); ids.forEach((id) => dirty.current.add(id)); },
        },
      );
    }, 600);
    return () => clearTimeout(t);
  }, [attendance, notes, session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = (id: string, status: Status) => {
    setAttendance((p) => ({ ...p, [id]: status }));
    dirty.current.add(id);
  };
  const setNote = (id: string, v: string) => {
    setNotes((p) => ({ ...p, [id]: v }));
    dirty.current.add(id);
  };

  const saveMeta = () => {
    if (!title.trim()) return toast.error('Title is required.');
    updateMut.mutate(
      {
        id: session.id,
        patch: { title: title.trim(), date, startTime: startTime || null, endTime: endTime || null, venueName: venue.trim() || null },
      },
      { onSuccess: () => setEditMeta(false), onError: (e: any) => toast.error(e?.message || 'Could not update.') },
    );
  };

  const q = search.toLowerCase();
  const roster = athletes.filter(
    (a) =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      a.studentId.toLowerCase().includes(q),
  );
  const markedCount = athletes.filter((a) => attendance[a.id]).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {editMeta ? (
            <div className="grid grid-cols-2 gap-2 pr-6 sm:grid-cols-6">
              <input className={`${inputCls} col-span-2 sm:col-span-3`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
              <input type="date" className={`${inputCls} col-span-2 sm:col-span-3`} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
              <input type="time" className={`${inputCls} sm:col-span-1`} value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Start time" />
              <input type="time" className={`${inputCls} sm:col-span-1`} value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="End time" />
              <input className={`${inputCls} col-span-2 sm:col-span-4`} placeholder="Venue" value={venue} maxLength={120} onChange={(e) => setVenue(e.target.value)} aria-label="Venue" />
              <div className="col-span-2 flex gap-2 sm:col-span-6">
                <Button size="sm" onClick={saveMeta} disabled={updateMut.isPending}>Save</Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  setEditMeta(false); setTitle(session.title); setDate(session.date);
                  setStartTime(session.startTime ?? ''); setEndTime(session.endTime ?? ''); setVenue(session.venueName ?? '');
                }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <DialogTitle className="text-left">{session.title}</DialogTitle>
              <button onClick={() => setEditMeta(true)} className="rounded p-1 text-destructive/60 hover:bg-gray-100 hover:text-gray-600" aria-label="Edit session">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-gray-500">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(session.date)}</span>
              {session.startTime && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeRange(session)}</span>}
              {session.venueName && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{session.venueName}</span>}
            </span>
            <SaveIndicator state={saveState} count={markedCount} total={athletes.length} />
          </div>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/60" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search athletes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {detailQ.isLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : roster.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">{athletes.length === 0 ? 'No athletes on your roster yet.' : 'No athletes match.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {roster.map((a) => {
              const { attended, denom, pct } = rateOf(history.get(a.id) ?? []);
              const low = pct !== null && pct < 0.75;
              const current = attendance[a.id];
              return (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.firstName} {a.lastName}</span>
                        {pct !== null && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              low ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}
                            title={`${attended} of ${denom} sessions attended`}
                          >
                            {low && <AlertTriangle className="h-3 w-3" />}
                            {attended}/{denom} · {Math.round(pct * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{a.studentId} • {a.department}</p>
                    </div>
                    <select
                      className={`h-9 w-40 shrink-0 rounded-md border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        current ? STATUS_TEXT[current] : 'text-destructive/60'
                      }`}
                      value={current ?? ''}
                      onChange={(e) => e.target.value && mark(a.id, e.target.value as Status)}
                    >
                      <option value="" disabled>Not marked</option>
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="text-gray-900">{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {(current === 'late' || current === 'excused' || current === 'absent') && (
                    <input
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Add a note (optional)"
                      value={notes[a.id] || ''}
                      onChange={(e) => setNote(a.id, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SaveIndicator({ state, count, total }: { state: string; count: number; total: number }) {
  if (state === 'saving') return <span className="flex items-center gap-1 text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>;
  if (state === 'error') return <span className="text-red-600">Save failed. Change a status to retry.</span>;
  if (state === 'saved') return <span className="flex items-center gap-1 text-green-700"><Check className="h-3.5 w-3.5" /> Saved · {count}/{total}</span>;
  return <span className="text-gray-500">{count}/{total} marked</span>;
}
