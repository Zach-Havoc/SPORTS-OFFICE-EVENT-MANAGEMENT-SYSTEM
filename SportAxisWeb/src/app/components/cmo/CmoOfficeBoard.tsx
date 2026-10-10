/**
 * The office's side of CMO: everything coaches have forwarded, arranged by
 * college (left rail), then sport and division, then athlete. Athletes are
 * reviewed in a side drawer that steps through the list, or decided in bulk.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  MessageSquareQuote,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { FormError, errorText } from '../ui/form-error';
import { useCmoOverview, useReviewCmo } from '../../hooks/api';
import type { CmoEntry } from '../../services/api';
import { useDeptAbbreviator } from '../../utils/departments';
import { sportOf } from '../../utils/sports';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AthleteDocuments, OfficeChip, fmtDate } from './CmoParts';

const ALL = 'all';
type Status = CmoEntry['status'] | typeof ALL;
type Decide = (ids: number[], decision: 'accepted' | 'returned', note?: string, done?: () => void) => void;

const groupOf = (e: CmoEntry) => e.division ?? e.sport ?? 'Unassigned sport';
const sportKey = (e: CmoEntry) => sportOf(e.division ?? e.sport ?? 'Unassigned');

/** "3 days ago", for how long an athlete has been waiting. */
function ago(iso: string | null) {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
/** Waiting longer than three days. */
const stale = (e: CmoEntry) =>
  e.status === 'submitted' && !!e.submittedAt && Date.now() - new Date(e.submittedAt).getTime() > 3 * 86400000;

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
      <span className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function CmoOfficeBoard() {
  const overview = useCmoOverview();
  const review = useReviewCmo();
  const abbr = useDeptAbbreviator();
  const entries = useMemo(() => overview.data ?? [], [overview.data]);

  const [status, setStatus] = useState<Status>('submitted');
  const [college, setCollege] = useState(ALL);
  const [sport, setSport] = useState(ALL);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [reviewing, setReviewing] = useState<number | null>(null);
  // Why a decision failed, shown above the board (no pop-ups on this site).
  const [decideError, setDecideError] = useState('');
  const [bulkReturn, setBulkReturn] = useState(false);

  const sports = useMemo(() => [...new Set(entries.map(sportKey))].sort(), [entries]);

  // Status, sport and search narrow everything; the college rail counts what's left.
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (status === ALL || e.status === status) &&
        (sport === ALL || sportKey(e) === sport) &&
        (!needle ||
          e.athleteName.toLowerCase().includes(needle) ||
          (e.coachName ?? '').toLowerCase().includes(needle)),
    );
  }, [entries, status, sport, q]);

  const colleges = useMemo(() => {
    const m = new Map<string, { all: CmoEntry[]; shown: number }>();
    for (const e of entries) {
      if (!m.has(e.department)) m.set(e.department, { all: [], shown: 0 });
      m.get(e.department)!.all.push(e);
    }
    for (const e of base) m.get(e.department)!.shown++;
    return [...m.entries()]
      .map(([dept, v]) => ({
        dept,
        shown: v.shown,
        total: v.all.length,
        waiting: v.all.filter((e) => e.status === 'submitted').length,
        accepted: v.all.filter((e) => e.status === 'accepted').length,
      }))
      .sort((a, b) => abbr(a.dept).localeCompare(abbr(b.dept)));
  }, [entries, base, abbr]);

  const shown = useMemo(() => base.filter((e) => college === ALL || e.department === college), [base, college]);

  // College → sport/division → athletes, alphabetically.
  const tree = useMemo(() => {
    const byCollege = new Map<string, Map<string, CmoEntry[]>>();
    for (const e of shown) {
      if (!byCollege.has(e.department)) byCollege.set(e.department, new Map());
      const g = byCollege.get(e.department)!;
      g.set(groupOf(e), [...(g.get(groupOf(e)) ?? []), e]);
    }
    return [...byCollege.entries()]
      .sort(([a], [b]) => abbr(a).localeCompare(abbr(b)))
      .map(([dept, groups]) => ({
        dept,
        groups: [...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, list]) => ({
            name,
            list: [...list].sort((a, b) => a.athleteName.localeCompare(b.athleteName)),
            // Progress counts every athlete forwarded in this group, whatever the filter.
            all: entries.filter((e) => e.department === dept && groupOf(e) === name),
          })),
      }));
  }, [shown, entries, abbr]);

  // The drawer steps through athletes in the order they're listed.
  const ordered = useMemo(() => tree.flatMap((c) => c.groups.flatMap((g) => g.list)), [tree]);

  // Only waiting athletes can be picked; drop picks that were decided or filtered out.
  useEffect(() => {
    const live = new Set(ordered.filter((e) => e.status === 'submitted').map((e) => e.id));
    setPicked((prev) => {
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [ordered]);

  const count = (s: CmoEntry['status']) => entries.filter((e) => e.status === s).length;
  const staleCount = entries.filter(stale).length;

  const decide: Decide = (ids, decision, note, done) => {
    setDecideError('');
    review.mutate(
      { entryIds: ids, status: decision, note },
      {
        onSuccess: (r) => {
          toast.success(`${r.updated} ${r.updated === 1 ? 'athlete' : 'athletes'} ${decision}.`);
          setPicked((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
          done?.();
        },
        onError: (e: any) => setDecideError(errorText(e, 'Could not save the decision')),
      },
    );
  };

  const toggle = (ids: number[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const tabs: [Status, string, number][] = [
    ['submitted', 'Waiting for review', count('submitted')],
    ['accepted', 'Accepted', count('accepted')],
    ['returned', 'Returned', count('returned')],
    [ALL, 'All', entries.length],
  ];

  return (
    <div className="space-y-4">
      <FormError message={decideError} />
      {/* Status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Status">
          {tabs.map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={status === key}
              onClick={() => setStatus(key)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
              <span
                className={`rounded px-1.5 text-xs tabular-nums ${
                  status === key && key === 'submitted' && n > 0 ? 'bg-sky-100 text-sky-800' : 'bg-gray-200/70 text-gray-700'
                }`}
              >
                {n}
              </span>
            </button>
          ))}
        </div>
        {staleCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
            <Clock3 className="h-4 w-4" />
            {staleCount} waiting more than 3 days
          </span>
        )}
      </div>

      {/* Search and sport */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search athlete or coach" className="pl-9" aria-label="Search athlete or coach" />
        </div>
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
      ) : entries.length === 0 ? (
        <Empty text="No coach has forwarded CMO documents yet. Athletes appear here once their coach forwards them." />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          {/* Colleges */}
          <nav aria-label="Colleges" className="min-w-0 lg:sticky lg:top-20">
            <p className="mb-1.5 hidden px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:block">Colleges</p>
            <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
              <CollegeItem
                active={college === ALL}
                onClick={() => setCollege(ALL)}
                title="All colleges"
                shown={base.length}
                waiting={count('submitted')}
                accepted={count('accepted')}
                total={entries.length}
              />
              {colleges.map((c) => (
                <CollegeItem
                  key={c.dept}
                  active={college === c.dept}
                  onClick={() => setCollege(c.dept)}
                  title={abbr(c.dept)}
                  subtitle={c.dept !== abbr(c.dept) ? c.dept : undefined}
                  shown={c.shown}
                  waiting={c.waiting}
                  accepted={c.accepted}
                  total={c.total}
                />
              ))}
            </ul>
          </nav>

          {/* Sports and athletes */}
          <div className="min-w-0 space-y-5">
            {tree.length === 0 ? (
              <Empty
                text={
                  status === 'submitted' && !q && sport === ALL
                    ? 'All caught up — nobody here is waiting for review.'
                    : 'Nothing matches these filters.'
                }
              />
            ) : (
              tree.map(({ dept, groups }) => (
                <section key={dept} className="space-y-3">
                  {college === ALL && (
                    <h3 className="flex items-baseline gap-2 border-b border-gray-200 pb-1.5">
                      <span className="font-semibold text-gray-900">{abbr(dept)}</span>
                      {dept !== abbr(dept) && <span className="truncate text-sm text-gray-500">{dept}</span>}
                    </h3>
                  )}
                  {groups.map((g) => (
                    <SportCard
                      key={g.name}
                      name={g.name}
                      list={g.list}
                      all={g.all}
                      picked={picked}
                      busy={review.isPending}
                      onToggle={toggle}
                      onOpen={setReviewing}
                      onDecide={decide}
                    />
                  ))}
                </section>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {picked.size > 0 && (
        <div className="sticky bottom-20 z-20 mx-auto flex w-fit max-w-full items-center gap-1.5 sm:gap-2 lg:bottom-4 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
          <span className="whitespace-nowrap px-1 text-sm font-medium text-gray-900 tabular-nums">
            {picked.size}<span className="hidden sm:inline"> {picked.size === 1 ? 'athlete' : 'athletes'}</span> selected
          </span>
          <Button size="sm" disabled={review.isPending} onClick={() => decide([...picked], 'accepted')}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Accept
          </Button>
          <Button size="sm" variant="secondary" disabled={review.isPending} onClick={() => setBulkReturn(true)}>
            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            Return…
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ReturnDialog
        open={bulkReturn}
        count={picked.size}
        busy={review.isPending}
        onClose={() => setBulkReturn(false)}
        onReturn={(note) => decide([...picked], 'returned', note, () => setBulkReturn(false))}
      />

      <ReviewDrawer
        list={ordered}
        currentId={reviewing}
        busy={review.isPending}
        abbr={abbr}
        onMove={setReviewing}
        onDecide={decide}
      />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
      <FileText className="mx-auto h-7 w-7 text-gray-300" />
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">{text}</p>
    </div>
  );
}

function CollegeItem({
  active,
  onClick,
  title,
  subtitle,
  shown,
  waiting,
  accepted,
  total,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  shown: number;
  waiting: number;
  accepted: number;
  total: number;
}) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'true' : undefined}
        title={subtitle}
        className={`w-full min-w-36 rounded-md border px-2.5 py-2 text-left transition-colors lg:min-w-0 ${
          active ? 'border-gray-900 bg-white shadow-sm' : 'border-transparent hover:bg-gray-100'
        } ${shown === 0 && !active ? 'opacity-55' : ''}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">{title}</span>
          {waiting > 0 && (
            <span className="shrink-0 rounded bg-sky-100 px-1.5 text-xs font-semibold tabular-nums text-sky-800" title="Waiting for review">
              {waiting}
            </span>
          )}
        </span>
        <span className="mt-1.5 block">
          <Bar done={accepted} total={total} />
        </span>
        <span className="mt-1 block text-[11px] tabular-nums text-gray-500">
          {accepted} of {total} accepted
        </span>
      </button>
    </li>
  );
}

function SportCard({
  name,
  list,
  all,
  picked,
  busy,
  onToggle,
  onOpen,
  onDecide,
}: {
  name: string;
  list: CmoEntry[];
  all: CmoEntry[];
  picked: Set<number>;
  busy: boolean;
  onToggle: (ids: number[], on: boolean) => void;
  onOpen: (id: number) => void;
  onDecide: Decide;
}) {
  const waiting = list.filter((e) => e.status === 'submitted');
  const pickedHere = waiting.filter((e) => picked.has(e.id)).length;
  const coaches = [...new Set(all.map((e) => e.coachName).filter(Boolean))];
  const accepted = all.filter((e) => e.status === 'accepted').length;

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 bg-gray-50/70 px-3 py-2.5">
        {waiting.length > 0 && (
          <Checkbox
            aria-label={`Select every waiting athlete in ${name}`}
            checked={pickedHere === 0 ? false : pickedHere === waiting.length ? true : 'indeterminate'}
            onCheckedChange={(v) => onToggle(waiting.map((e) => e.id), v === true)}
          />
        )}
        <div className="min-w-0 flex-1 basis-40">
          <h4 className="truncate text-sm font-semibold text-gray-900">{name}</h4>
          <p className="truncate text-xs text-gray-500">{coaches.length ? `Coach ${coaches.join(', ')}` : 'No coach on record'}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-28 shrink-0">
            <p className="mb-1 text-right text-[11px] tabular-nums text-gray-500">
              {accepted}/{all.length} accepted
            </p>
            <Bar done={accepted} total={all.length} />
          </div>
          {waiting.length > 1 && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onDecide(waiting.map((e) => e.id), 'accepted')}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Accept all {waiting.length}
            </Button>
          )}
        </div>
      </header>
      <ul className="divide-y divide-gray-100">
        {list.map((e) => (
          <li key={e.id} className="group flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
            {e.status === 'submitted' ? (
              <Checkbox aria-label={`Select ${e.athleteName}`} checked={picked.has(e.id)} onCheckedChange={(v) => onToggle([e.id], v === true)} />
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <button type="button" onClick={() => onOpen(e.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium text-gray-900 group-hover:underline">{e.athleteName}</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                {e.status === 'submitted' ? (
                  <span className={stale(e) ? 'font-medium text-amber-700' : ''}>Forwarded {ago(e.submittedAt)}</span>
                ) : (
                  <span className={e.status === 'returned' ? 'truncate text-red-700' : 'truncate'}>
                    {e.status === 'returned' ? 'Returned' : 'Accepted'} {ago(e.reviewedAt)}
                    {e.officeNote ? ` · ${e.officeNote}` : ''}
                  </span>
                )}
                {e.coachNote && <MessageSquareQuote className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="Coach left a note" />}
              </span>
            </button>
            <span className="hidden sm:inline-flex">
              <OfficeChip state={e.status} />
            </span>
            <Button size="sm" variant="ghost" onClick={() => onOpen(e.id)}>
              {e.status === 'submitted' ? 'Review' : 'View'}
            </Button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** One athlete at a time: documents, the coach's note, and the decision. */
function ReviewDrawer({
  list,
  currentId,
  busy,
  abbr,
  onMove,
  onDecide,
}: {
  list: CmoEntry[];
  currentId: number | null;
  busy: boolean;
  abbr: (d: string) => string;
  onMove: (id: number | null) => void;
  onDecide: Decide;
}) {
  // Keep the last athlete while the list refreshes after a decision.
  const [last, setLast] = useState<CmoEntry | null>(null);
  const found = list.find((e) => e.id === currentId) ?? null;
  useEffect(() => {
    if (found) setLast(found);
  }, [found]);
  const e = found ?? (currentId !== null && last?.id === currentId ? last : null);

  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => {
    setReturning(false);
    setNote('');
  }, [currentId]);

  const idx = e ? list.findIndex((x) => x.id === e.id) : -1;
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  // After a decision, go to the next athlete still waiting, else close.
  const nextWaiting = () => {
    const after = list.slice(idx + 1).find((x) => x.status === 'submitted' && x.id !== e?.id);
    const before = list.slice(0, Math.max(idx, 0)).find((x) => x.status === 'submitted' && x.id !== e?.id);
    onMove((after ?? before)?.id ?? null);
  };

  return (
    <Sheet open={currentId !== null && !!e} onOpenChange={(o) => !o && onMove(null)}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        {e && (
          <>
            <SheetHeader className="border-b border-gray-100 pr-12">
              <div className="flex items-center gap-2">
                <SheetTitle className="truncate">{e.athleteName}</SheetTitle>
                <OfficeChip state={e.status} />
              </div>
              <SheetDescription>
                {abbr(e.department)} · {groupOf(e)}
                {e.coachName ? ` · Coach ${e.coachName}` : ''}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Forwarded</dt>
                  <dd className={stale(e) ? 'font-medium text-amber-700' : 'text-gray-900'}>
                    {fmtDate(e.submittedAt)}
                    <span className="block text-xs font-normal text-gray-500">{ago(e.submittedAt)}</span>
                  </dd>
                </div>
                {e.status !== 'submitted' && (
                  <div>
                    <dt className="text-xs text-gray-500">{e.status === 'returned' ? 'Returned' : 'Accepted'}</dt>
                    <dd className="text-gray-900">
                      {fmtDate(e.reviewedAt)}
                      {e.reviewerName && <span className="block text-xs text-gray-500">by {e.reviewerName}</span>}
                    </dd>
                  </div>
                )}
              </dl>

              {e.coachNote && (
                <blockquote className="rounded-md border-l-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="mb-0.5 block text-xs font-medium text-gray-500">Note from the coach</span>
                  {e.coachNote}
                </blockquote>
              )}

              {e.status === 'returned' && e.officeNote && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  <span className="mb-0.5 block text-xs font-medium">Returned with this note</span>
                  {e.officeNote}
                </p>
              )}

              <section>
                <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Documents</h5>
                <AthleteDocuments athleteId={e.athleteId} stacked />
              </section>

              {returning && (
                <section className="space-y-2">
                  <label htmlFor="cmo-return-note" className="text-sm font-medium text-gray-900">
                    What should the coach fix?
                  </label>
                  <Textarea
                    id="cmo-return-note"
                    autoFocus
                    value={note}
                    onChange={(ev) => setNote(ev.target.value)}
                    placeholder="e.g. The medical certificate is unsigned."
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">The coach gets this note by email and in the app.</p>
                </section>
              )}
            </div>

            <footer className="space-y-3 border-t border-gray-100 p-4">
              {e.status === 'submitted' &&
                (returning ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setReturning(false)} disabled={busy}>Cancel</Button>
                    <Button
                      className="flex-1"
                      variant="secondary"
                      disabled={busy || !note.trim()}
                      onClick={() => onDecide([e.id], 'returned', note.trim(), nextWaiting)}
                    >
                      <Undo2 className="mr-1.5 h-4 w-4" />
                      Return to coach
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setReturning(true)} disabled={busy}>
                      <Undo2 className="mr-1.5 h-4 w-4" />
                      Return…
                    </Button>
                    <Button className="flex-1" disabled={busy} onClick={() => onDecide([e.id], 'accepted', undefined, nextWaiting)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      {busy ? 'Saving…' : 'Accept'}
                    </Button>
                  </div>
                ))}
              <div className="flex items-center justify-between text-sm">
                <Button size="sm" variant="ghost" disabled={!prev} onClick={() => prev && onMove(prev.id)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-xs tabular-nums text-gray-500">
                  {idx + 1} of {list.length}
                </span>
                <Button size="sm" variant="ghost" disabled={!next} onClick={() => next && onMove(next.id)}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReturnDialog({
  open,
  count,
  busy,
  onClose,
  onReturn,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onReturn: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Return {count} {count === 1 ? 'athlete' : 'athletes'} to their coach
          </DialogTitle>
          <DialogDescription>Every coach involved gets this note by email and in the app.</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          placeholder="What should the coach fix? (e.g. the certificates of enrollment are for last semester)"
          rows={3}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy || !note.trim()} onClick={() => onReturn(note.trim())}>
            <Undo2 className="mr-1.5 h-4 w-4" />
            Return to coach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
