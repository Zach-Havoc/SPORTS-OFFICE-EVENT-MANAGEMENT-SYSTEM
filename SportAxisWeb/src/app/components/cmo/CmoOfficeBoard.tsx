/**
 * The office's side of CMO: everything coaches have forwarded, arranged by
 * college, then sport and division, then athlete. Accept athletes (one by
 * one, or every waiting one in a group), or return them with a note.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, FileText, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCmoOverview, useReviewCmo } from '../../hooks/api';
import type { CmoEntry } from '../../services/api';
import { useDeptAbbreviator } from '../../utils/departments';
import { sportOf } from '../../utils/sports';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AthleteDocuments, OfficeChip, fmtDate } from './CmoParts';

const ALL = 'all';

export function CmoOfficeBoard() {
  const overview = useCmoOverview();
  const review = useReviewCmo();
  const abbr = useDeptAbbreviator();
  const entries = overview.data ?? [];

  const [status, setStatus] = useState<string>('submitted');
  const [college, setCollege] = useState(ALL);
  const [sport, setSport] = useState(ALL);
  const [q, setQ] = useState('');

  const colleges = useMemo(() => [...new Set(entries.map((e) => e.department))].sort(), [entries]);
  const sports = useMemo(
    () => [...new Set(entries.map((e) => sportOf(e.division ?? e.sport ?? 'Unassigned')))].sort(),
    [entries],
  );

  const shown = entries.filter(
    (e) =>
      (status === ALL || e.status === status) &&
      (college === ALL || e.department === college) &&
      (sport === ALL || sportOf(e.division ?? e.sport ?? 'Unassigned') === sport) &&
      (!q.trim() || e.athleteName.toLowerCase().includes(q.trim().toLowerCase())),
  );

  // College → sport/division → athletes, alphabetically.
  const tree = useMemo(() => {
    const byCollege = new Map<string, Map<string, CmoEntry[]>>();
    for (const e of shown) {
      const group = e.division ?? e.sport ?? 'Unassigned sport';
      if (!byCollege.has(e.department)) byCollege.set(e.department, new Map());
      const g = byCollege.get(e.department)!;
      g.set(group, [...(g.get(group) ?? []), e]);
    }
    return [...byCollege.entries()]
      .sort(([a], [b]) => abbr(a).localeCompare(abbr(b)))
      .map(([dept, groups]) => ({
        dept,
        groups: [...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, list]) => ({ name, list: list.sort((a, b) => a.athleteName.localeCompare(b.athleteName)) })),
      }));
  }, [shown, abbr]);

  const count = (s: CmoEntry['status']) => entries.filter((e) => e.status === s).length;

  const decide = (ids: number[], decision: 'accepted' | 'returned', note?: string, done?: () => void) =>
    review.mutate(
      { entryIds: ids, status: decision, note },
      {
        onSuccess: (r) => {
          toast.success(`${r.updated} ${r.updated === 1 ? 'athlete' : 'athletes'} ${decision}.`);
          done?.();
        },
        onError: (e: any) => toast.error(e?.message || 'Could not save the decision'),
      },
    );

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 sm:max-w-xl">
        {(
          [
            ['Waiting for review', count('submitted'), 'submitted'],
            ['Accepted', count('accepted'), 'accepted'],
            ['Returned', count('returned'), 'returned'],
          ] as const
        ).map(([label, n, key]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`rounded-md border px-3 py-2 text-left transition-colors ${
              status === key ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-gray-900">{n}</dd>
          </button>
        ))}
      </dl>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,11rem))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search athlete" className="pl-9" aria-label="Search athlete" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="submitted">Waiting for review</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={college} onValueChange={setCollege}>
          <SelectTrigger aria-label="College">
            <SelectValue>{college === ALL ? 'All colleges' : abbr(college)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All colleges</SelectItem>
            {colleges.map((c) => <SelectItem key={c} value={c}>{abbr(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger aria-label="Sport"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sports</SelectItem>
            {sports.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {overview.isLoading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading submissions…</p>
      ) : tree.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <FileText className="mx-auto h-7 w-7 text-gray-300" />
          <p className="mt-2 text-sm text-gray-600">
            {entries.length === 0
              ? 'No coach has forwarded CMO documents yet.'
              : 'Nothing matches these filters.'}
          </p>
        </div>
      ) : (
        tree.map(({ dept, groups }) => {
          const all = groups.flatMap((g) => g.list);
          const waiting = all.filter((e) => e.status === 'submitted').length;
          return (
            <details key={dept} open={waiting > 0 || tree.length === 1} className="group rounded-lg border border-gray-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-0 -rotate-90" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-gray-900">{abbr(dept)}</span>
                  <span className="ml-2 hidden text-sm text-gray-500 sm:inline">{dept !== abbr(dept) ? dept : ''}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                  {all.length} {all.length === 1 ? 'athlete' : 'athletes'}
                  {waiting > 0 && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">{waiting} waiting</span>}
                </span>
              </summary>
              <div className="space-y-4 border-t border-gray-100 px-4 pt-3 pb-4">
                {groups.map((g) => (
                  <SportGroup key={g.name} name={g.name} list={g.list} busy={review.isPending} onDecide={decide} />
                ))}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}

function SportGroup({
  name,
  list,
  busy,
  onDecide,
}: {
  name: string;
  list: CmoEntry[];
  busy: boolean;
  onDecide: (ids: number[], decision: 'accepted' | 'returned', note?: string, done?: () => void) => void;
}) {
  const waiting = list.filter((e) => e.status === 'submitted');
  const coaches = [...new Set(list.map((e) => e.coachName).filter(Boolean))];
  return (
    <section>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">
          {name}
          <span className="ml-2 font-normal text-gray-500">
            {coaches.length ? `Coach ${coaches.join(', ')}` : ''}
          </span>
        </h4>
        {waiting.length > 1 && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onDecide(waiting.map((e) => e.id), 'accepted')}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Accept all {waiting.length} waiting
          </Button>
        )}
      </div>
      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {list.map((e) => (
          <AthleteRow key={e.id} entry={e} busy={busy} onDecide={onDecide} />
        ))}
      </ul>
    </section>
  );
}

function AthleteRow({
  entry: e,
  busy,
  onDecide,
}: {
  entry: CmoEntry;
  busy: boolean;
  onDecide: (ids: number[], decision: 'accepted' | 'returned', note?: string, done?: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');

  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">{e.athleteName}</span>
          <span className="block text-xs text-gray-500">
            Forwarded {fmtDate(e.submittedAt)}
            {e.coachNote ? ` · “${e.coachNote}”` : ''}
          </span>
        </span>
        <OfficeChip state={e.status} />
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <FileText className="mr-1 h-3.5 w-3.5" />
          {open ? 'Hide documents' : 'Documents'}
        </Button>
        {e.status === 'submitted' && (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onDecide([e.id], 'accepted')}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Accept
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReturning((r) => !r)}>
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              Return
            </Button>
          </>
        )}
      </div>

      {e.status !== 'submitted' && (e.officeNote || e.reviewedAt) && (
        <p className={`mt-1 text-xs ${e.status === 'returned' ? 'text-red-700' : 'text-gray-500'}`}>
          {e.status === 'returned' ? 'Returned' : 'Accepted'}
          {e.reviewerName ? ` by ${e.reviewerName}` : ''} {fmtDate(e.reviewedAt)}
          {e.officeNote ? ` · ${e.officeNote}` : ''}
        </p>
      )}

      {returning && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="What should the coach fix? (e.g. the medical certificate is unsigned)"
            rows={2}
            className="sm:flex-1"
          />
          <Button
            size="sm"
            disabled={busy || !note.trim()}
            onClick={() => onDecide([e.id], 'returned', note.trim(), () => { setReturning(false); setNote(''); })}
          >
            Return to coach
          </Button>
        </div>
      )}

      {open && (
        <div className="mt-2 rounded-md bg-gray-50 px-2">
          <AthleteDocuments athleteId={e.athleteId} />
        </div>
      )}
    </li>
  );
}
