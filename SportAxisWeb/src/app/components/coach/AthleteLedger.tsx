import { useMemo, useState } from 'react';
import { CalendarCheck, Download, FileText, Swords, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

/**
 * The athlete ledger: one chronological record of everything the office and
 * the coach hold about an athlete — training attendance, games their team
 * played, performance ratings with the coach's remarks, and CMO requirement
 * submissions — newest first, filterable, and exportable as CSV.
 */

export type LedgerKind = 'attendance' | 'game' | 'performance' | 'requirement';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  date: string; // ISO date or datetime
  title: string;
  detail?: string;
  status?: string;
  remark?: string;
}

const KIND: Record<LedgerKind, { label: string; icon: typeof CalendarCheck; tone: string }> = {
  attendance: { label: 'Attendance', icon: CalendarCheck, tone: 'bg-sky-50 text-sky-700' },
  game: { label: 'Game', icon: Swords, tone: 'bg-violet-50 text-violet-700' },
  performance: { label: 'Performance', icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-700' },
  requirement: { label: 'Requirement', icon: FileText, tone: 'bg-amber-50 text-amber-700' },
};

const FILTERS: { value: LedgerKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'game', label: 'Games' },
  { value: 'performance', label: 'Performance' },
  { value: 'requirement', label: 'Requirements' },
];

const dayOf = (d: string) => new Date(d.length <= 10 ? `${d}T00:00:00` : d);
const fmtDay = (d: string) => dayOf(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtMonth = (d: string) => dayOf(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

function toCsv(rows: LedgerEntry[]): string {
  const q = (v: string | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
  return [
    ['Date', 'Type', 'Item', 'Detail', 'Status', 'Remark'].join(','),
    ...rows.map((r) =>
      [q(dayOf(r.date).toISOString().slice(0, 10)), q(KIND[r.kind].label), q(r.title), q(r.detail), q(r.status), q(r.remark)].join(','),
    ),
  ].join('\n');
}

export function AthleteLedger({ athleteName, entries }: { athleteName: string; entries: LedgerEntry[] }) {
  const [filter, setFilter] = useState<LedgerKind | 'all'>('all');

  const sorted = useMemo(
    () => [...entries].sort((a, b) => dayOf(b.date).getTime() - dayOf(a.date).getTime()),
    [entries],
  );
  const shown = filter === 'all' ? sorted : sorted.filter((e) => e.kind === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [entries]);

  // Group consecutive entries by month for scannable headings.
  const groups = useMemo(() => {
    const out: { month: string; items: LedgerEntry[] }[] = [];
    for (const e of shown) {
      const m = fmtMonth(e.date);
      if (out.at(-1)?.month !== m) out.push({ month: m, items: [] });
      out.at(-1)!.items.push(e);
    }
    return out;
  }, [shown]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ledger-${athleteName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Athlete Ledger</CardTitle>
          <CardDescription>
            Every attendance mark, game, performance rating with remarks, and requirement — newest first.
          </CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!shown.length}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-70">{counts[f.value] ?? 0}</span>
            </button>
          ))}
        </div>

        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Nothing recorded for this athlete yet.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.month}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.month}</h3>
                <ol className="space-y-1.5 border-l border-gray-200 pl-4">
                  {g.items.map((e) => {
                    const k = KIND[e.kind];
                    const Icon = k.icon;
                    return (
                      <li key={`${e.kind}-${e.id}`} className="relative">
                        <span className="absolute -left-[21px] top-2.5 h-2 w-2 rounded-full bg-gray-300" aria-hidden />
                        <div className="flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-gray-50 sm:flex-row sm:items-start sm:gap-3">
                          <span className="w-24 shrink-0 text-xs tabular-nums text-gray-500">{fmtDay(e.date)}</span>
                          <span className={`inline-flex w-fit shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${k.tone}`}>
                            <Icon className="h-3 w-3" />
                            {k.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900">
                              {e.title}
                              {e.status && <span className="ml-2 text-xs font-medium capitalize text-gray-600">· {e.status}</span>}
                            </p>
                            {e.detail && <p className="text-xs text-gray-500">{e.detail}</p>}
                            {e.remark && <p className="mt-0.5 text-xs italic text-gray-600">“{e.remark}”</p>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
