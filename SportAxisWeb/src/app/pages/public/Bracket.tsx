import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useBracket } from '../../hooks/api';
import { useDeptAbbreviator } from '../../utils/departments';
import Loading from '../../components/Loading';
import BracketTree from '../../components/BracketTree';
import { ArrowLeft, Trophy, Calendar, MapPin, Check } from 'lucide-react';

interface BMatch {
  id: string;
  round: number;
  slot: number;
  stageLabel: string;
  homeTeam: string | null;
  awayTeam: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venueName: string | null;
  winner: string | null;
  isBye: boolean;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  nextMatchId: string | null;
}

export default function PublicBracket() {
  const { id } = useParams<{ id: string }>();
  const { data: bracket, isLoading } = useBracket(id);
  const abbr = useDeptAbbreviator();

  const rounds = useMemo(() => {
    const matches: BMatch[] = bracket?.matches ?? [];
    const byRound = new Map<number, BMatch[]>();
    matches.forEach((m) => {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round)!.push(m);
    });
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, ms]) => ({
        round,
        label: ms[0]?.stageLabel ?? `Round ${round}`,
        matches: ms.sort((a, b) => a.slot - b.slot),
      }));
  }, [bracket]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Loading fullScreen={false} message="Loading bracket…" />
      </div>
    );
  }
  if (!bracket) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-gray-500">Bracket not found.</div>;
  }

  const isSingleElim = bracket.format !== 'round_robin';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/brackets"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          All brackets
        </Link>
        <h1 className="flex-1 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{bracket.name}</h1>
      </div>

      {bracket.champion && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <Trophy className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Champion</p>
            <p className="text-lg font-bold text-emerald-900" title={bracket.champion}>{abbr(bracket.champion)}</p>
          </div>
        </div>
      )}

      {isSingleElim ? (
        <BracketTree matches={bracket.matches as any} />
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4">
          {rounds.map((r) => (
            <div key={r.round} className="flex shrink-0 flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700">{r.label}</h2>
              {r.matches.map((m) => (
                <div key={m.id} className="w-60 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="space-y-1 text-sm">
                    {[
                      { name: m.homeTeam, score: m.homeScore },
                      { name: m.awayTeam, score: m.awayScore },
                    ].map((p, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-1.5 ${m.winner && m.winner === p.name ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                        title={p.name ?? undefined}
                      >
                        {m.winner && m.winner === p.name && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                        <span className="min-w-0 flex-1 truncate">{p.name ? abbr(p.name) : 'TBD'}</span>
                        {p.score !== null && <span className="shrink-0 tabular-nums text-gray-500">{p.score}</span>}
                      </div>
                    ))}
                  </div>
                  {(m.scheduledDate || m.venueName) && (
                    <div className="mt-2 space-y-0.5 text-[11px] text-gray-400">
                      {m.scheduledDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {m.scheduledDate} {m.scheduledTime}
                        </div>
                      )}
                      {m.venueName && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {m.venueName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
