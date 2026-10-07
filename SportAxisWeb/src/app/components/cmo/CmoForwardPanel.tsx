/**
 * The coach's side of CMO: forward athletes whose required documents are all
 * approved to the sports office, in batches, and see what the office decided.
 */
import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { useCmoRoster, useSubmitCmo } from '../../hooks/api';
import type { CmoRosterAthlete } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { OfficeChip, type OfficeState, fmtDate } from './CmoParts';

const stateOf = (a: CmoRosterAthlete): OfficeState => a.office?.status ?? 'not_submitted';
/** Cleared, and not already with the office or accepted by it. */
const forwardable = (a: CmoRosterAthlete) => a.cleared && !['submitted', 'accepted'].includes(stateOf(a));

export function CmoForwardPanel() {
  const roster = useCmoRoster();
  const submit = useSubmitCmo();
  const athletes = roster.data ?? [];

  const ready = useMemo(() => athletes.filter(forwardable), [athletes]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  // Everyone ready is picked by default; re-picked when the list changes.
  const readyKey = ready.map((a) => a.id).join(',');
  useEffect(() => {
    setPicked(new Set(ready.map((a) => a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  const count = (s: OfficeState) => athletes.filter((a) => stateOf(a) === s).length;
  const notCleared = athletes.filter((a) => !a.cleared && !['submitted', 'accepted'].includes(stateOf(a))).length;

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const send = () => {
    const ids = [...picked].filter((id) => ready.some((a) => a.id === id));
    if (ids.length === 0) return void toast.error('Pick at least one cleared athlete to forward.');
    submit.mutate(
      { athleteIds: ids, note: note.trim() || undefined },
      {
        onSuccess: (r) => {
          toast.success(`${r.count} ${r.count === 1 ? 'athlete' : 'athletes'} forwarded to the sports office.`);
          setNote('');
        },
        onError: (e: any) => toast.error(e?.message || 'Could not forward to the office'),
      },
    );
  };

  // Ready first, then returned (needs work), then the rest.
  const order: Record<OfficeState, number> = { returned: 1, not_submitted: 2, submitted: 3, accepted: 4 };
  const sorted = [...athletes].sort(
    (a, b) =>
      Number(forwardable(b)) - Number(forwardable(a)) ||
      order[stateOf(a)] - order[stateOf(b)] ||
      a.name.localeCompare(b.name),
  );

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Forward to the Sports Office</CardTitle>
        <CardDescription>
          Once every required document of an athlete is approved, forward them to the office. The office accepts
          each athlete, or returns them with a note for you to fix and forward again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {(
            [
              ['Ready to forward', ready.length],
              ['With the office', count('submitted')],
              ['Accepted', count('accepted')],
              ['Returned', count('returned')],
              ['Not cleared yet', notCleared],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-md border border-gray-200 px-3 py-2">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums text-gray-900">{n}</dd>
            </div>
          ))}
        </dl>

        {roster.isLoading ? (
          <p className="text-sm text-gray-500">Loading your athletes…</p>
        ) : athletes.length === 0 ? (
          <p className="text-sm text-gray-500">No athletes on your roster yet.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      aria-label="Pick every athlete ready to forward"
                      checked={ready.length > 0 && ready.every((a) => picked.has(a.id))}
                      onCheckedChange={(v) => setPicked(v ? new Set(ready.map((a) => a.id)) : new Set())}
                      disabled={ready.length === 0}
                    />
                  </th>
                  <th className="px-3 py-2">Athlete</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Documents</th>
                  <th className="px-3 py-2">Office</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((a) => {
                  const can = forwardable(a);
                  const state = stateOf(a);
                  return (
                    <tr key={a.id} className={can ? '' : 'text-gray-500'}>
                      <td className="px-3 py-2 align-top">
                        <Checkbox
                          aria-label={`Forward ${a.name}`}
                          checked={picked.has(a.id)}
                          disabled={!can}
                          onCheckedChange={(v) => toggle(a.id, !!v)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="block font-medium text-gray-900">{a.name}</span>
                        <span className="text-xs text-gray-500">{a.division ?? a.sport ?? '—'}</span>
                      </td>
                      <td className="hidden px-3 py-2 align-top sm:table-cell">
                        <span className={`tabular-nums ${a.cleared ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {a.approvedCount}/{a.requiredCount} approved
                        </span>
                        {!a.cleared && a.missing.length > 0 && (
                          <span className="block text-xs text-gray-500">Missing: {a.missing.join(', ')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <OfficeChip state={state} />
                        {state === 'returned' && a.office?.officeNote && (
                          <span className="mt-1 block text-xs text-red-700">{a.office.officeNote}</span>
                        )}
                        {state === 'submitted' && a.office?.submittedAt && (
                          <span className="mt-1 block text-xs text-gray-500">since {fmtDate(a.office.submittedAt)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note to the office (e.g. team list attached, one athlete to follow)"
            rows={2}
            className="sm:flex-1"
          />
          <Button onClick={send} disabled={submit.isPending || picked.size === 0} className="sm:shrink-0">
            <Send className="mr-1.5 h-4 w-4" />
            {submit.isPending
              ? 'Forwarding…'
              : `Forward ${picked.size} ${picked.size === 1 ? 'athlete' : 'athletes'} to the office`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
