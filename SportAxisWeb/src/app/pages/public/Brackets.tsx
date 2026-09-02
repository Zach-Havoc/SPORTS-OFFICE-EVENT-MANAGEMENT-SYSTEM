import { useMemo } from 'react';
import { Link } from 'react-router';
import { useBrackets } from '../../hooks/api';
import { useDeptAbbreviator } from '../../utils/departments';
import Loading from '../../components/Loading';
import { Trophy, ChevronRight } from 'lucide-react';

interface BracketRow {
  id: string;
  sport: string;
  name: string;
  format: string;
  status: string;
  champion: string | null;
  matchCount: number;
}

export default function PublicBrackets() {
  const { data, isLoading } = useBrackets();
  const abbr = useDeptAbbreviator();

  const bySport = useMemo(() => {
    const rows = ((data ?? []) as BracketRow[]).filter((b) => b.status !== 'draft');
    const map = new Map<string, BracketRow[]>();
    rows.forEach((b) => {
      if (!map.has(b.sport)) map.set(b.sport, []);
      map.get(b.sport)!.push(b);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Loading fullScreen={false} message="Loading brackets…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Tournament Brackets</h1>
        <p className="mt-1.5 text-sm text-gray-500">Follow every elimination round as results come in.</p>
      </header>

      {bySport.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center">
          <Trophy className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No brackets published yet</p>
          <p className="mt-1 text-sm text-gray-500">Check back once the elimination rounds are drawn.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {bySport.map(([sport, brackets]) => (
            <section key={sport}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{sport}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {brackets.map((b) => (
                  <Link
                    key={b.id}
                    to={`/bracket/${b.id}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-red-200 hover:bg-red-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{b.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {b.format === 'round_robin' ? 'Round Robin' : 'Single Elimination'} · {b.matchCount} matches
                        {b.status === 'completed' && b.champion && (
                          <span className="ml-1 font-medium text-emerald-600" title={b.champion}>
                            · {abbr(b.champion)} 🏆
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
