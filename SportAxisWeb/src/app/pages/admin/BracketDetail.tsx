import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useBracket, useAdvanceBracketMatch, useDeleteBracket, usePublishBracket } from '../../hooks/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ArrowLeft, Trophy, Trash2, Calendar, MapPin, Check } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';
import { useDeptAbbreviator } from '../../utils/departments';
import BracketTree from '../../components/BracketTree';

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
  status: 'pending' | 'ready' | 'scheduled' | 'completed';
  eventId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  scored: boolean;
  nextMatchId: string | null;
}

const prevStageLabel = (label: string) => {
  if (label === 'Finals') return 'the Semi-Finals';
  if (label === 'Semi-Finals') return 'the Quarter-Finals';
  if (label === 'Quarter-Finals') return 'Round 1';
  return 'the previous round';
};

const STATUS_BADGE: Record<BMatch['status'], string> = {
  pending: 'bg-gray-100 text-gray-500',
  ready: 'bg-blue-50 text-blue-700',
  scheduled: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
};

type Advance = (matchId: string, body?: { winner?: string; force?: boolean }) => void;

/** The Use-result / Pick / change-result controls for one match. */
function MatchActions({ m, onAdvance, busy }: { m: BMatch; onAdvance: Advance; busy: boolean }) {
  const abbr = useDeptAbbreviator();
  const [picking, setPicking] = useState(false);
  const short = (t: string | null) => (t ? abbr(t) : 'TBD');
  const bothKnown = !!m.homeTeam && !!m.awayTeam;
  const actionable = bothKnown && !m.isBye && (m.status === 'scheduled' || m.status === 'ready');

  if (m.isBye) return <p className="text-xs text-gray-400">Bye — no game.</p>;
  if (!bothKnown) return <p className="text-xs text-gray-400">Waiting on {prevStageLabel(m.stageLabel)}.</p>;

  return (
    <div className="space-y-2">
      {actionable && !picking && (
        <div className="flex gap-1.5">
          <Button size="sm" className="h-8 flex-1 text-xs" disabled={busy} onClick={() => onAdvance(m.id)}>
            Use result
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => setPicking(true)}>
            Pick winner
          </Button>
        </div>
      )}

      {actionable && picking && (
        <div className="space-y-1">
          <p className="text-[11px] text-gray-500">Winner (forfeit / override):</p>
          <div className="flex flex-col gap-1">
            {[m.homeTeam, m.awayTeam].map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                className="h-8 justify-start text-xs"
                disabled={busy}
                title={t ?? undefined}
                onClick={() => {
                  onAdvance(m.id, { winner: t as string });
                  setPicking(false);
                }}
              >
                {short(t)}
              </Button>
            ))}
            <button className="self-start text-[11px] text-gray-400 hover:underline" onClick={() => setPicking(false)}>
              cancel
            </button>
          </div>
        </div>
      )}

      {m.status === 'completed' && (
        <button
          className="text-[11px] text-gray-400 hover:underline"
          disabled={busy}
          onClick={() => {
            const other = m.winner === m.homeTeam ? m.awayTeam : m.homeTeam;
            if (other && confirm(`Change the result to ${other}?`)) {
              onAdvance(m.id, { winner: other, force: true });
            }
          }}
        >
          change result
        </button>
      )}
    </div>
  );
}

/** A flat match card — used for round-robin (which has no tree). */
function MatchCard({ m, onAdvance, busy }: { m: BMatch; onAdvance: Advance; busy: boolean }) {
  const abbr = useDeptAbbreviator();
  const short = (t: string | null) => (t ? abbr(t) : 'TBD');

  return (
    <Card className="w-60 shrink-0">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">{m.stageLabel}</span>
          <Badge className={`text-[10px] ${STATUS_BADGE[m.status]}`}>{m.isBye ? 'bye' : m.status}</Badge>
        </div>

        <div className="space-y-1 text-sm">
          <TeamRow name={m.homeTeam} label={short(m.homeTeam)} isWinner={!!m.winner && m.winner === m.homeTeam} score={m.homeScore} />
          <TeamRow name={m.awayTeam} label={short(m.awayTeam)} isWinner={!!m.winner && m.winner === m.awayTeam} score={m.awayScore} />
        </div>

        {m.status === 'completed' && !m.isBye && !m.scored && m.homeScore === null && (
          <p className="text-[11px] text-amber-600">Decided manually.</p>
        )}

        {(m.scheduledDate || m.venueName) && (
          <div className="space-y-0.5 text-[11px] text-gray-400">
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

        <MatchActions m={m} onAdvance={onAdvance} busy={busy} />
      </CardContent>
    </Card>
  );
}

function TeamRow({
  name,
  label,
  isWinner,
  score,
}: {
  name: string | null;
  label: string;
  isWinner: boolean;
  score: number | null;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${isWinner ? 'font-semibold text-gray-900' : 'text-gray-600'}`} title={name ?? undefined}>
      {isWinner && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {score !== null && <span className="shrink-0 tabular-nums text-gray-500">{score}</span>}
    </div>
  );
}

export default function BracketDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const abbr = useDeptAbbreviator();

  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/login');
  }, [user, navigate]);

  const { data: bracket, isLoading } = useBracket(id);
  const advance = useAdvanceBracketMatch();
  const del = useDeleteBracket();
  const publish = usePublishBracket();

  const [manageId, setManageId] = useState<string | null>(null);

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

  if (!user || user.role !== 'admin') return null;
  if (isLoading) return <div className="p-8"><Loading fullScreen={false} message="Loading bracket…" /></div>;
  if (!bracket) return <div className="p-8 text-gray-500">Bracket not found.</div>;

  const isSingleElim = bracket.format !== 'round_robin';
  const manageMatch: BMatch | undefined = (bracket.matches as BMatch[]).find((m) => m.id === manageId);

  const onAdvance: Advance = (matchId, body) => {
    advance.mutate(
      { bracketId: bracket.id, matchId, body },
      {
        onSuccess: () => {
          toast.success('Bracket updated.');
          setManageId(null);
        },
        onError: (e: any) => toast.error(e?.message || 'Could not advance. Score the match first, or use “Pick winner”.'),
      },
    );
  };

  const onDelete = () => {
    if (!confirm('Delete this bracket? Its scheduled events will also be removed.')) return;
    del.mutate(
      { id: bracket.id, withEvents: true },
      {
        onSuccess: () => {
          toast.success('Bracket deleted.');
          navigate('/admin/bracketing');
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin/bracketing">
          <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{bracket.name}</h1>
          <p className="text-sm text-gray-500">
            {bracket.format === 'round_robin' ? 'Round Robin' : 'Single Elimination'} · {bracket.matches.length} matches
          </p>
        </div>
        <Badge className={bracket.status === 'completed' ? 'bg-emerald-600' : bracket.status === 'active' ? 'bg-blue-600' : 'bg-gray-500'}>
          {bracket.status}
        </Badge>
        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />Delete
        </Button>
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

      {bracket.status === 'draft' && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <span className="flex-1">Draft — no events created yet.</span>
          <Button
            size="sm"
            disabled={publish.isPending}
            onClick={() =>
              publish.mutate(bracket.id, {
                onSuccess: () => toast.success('Published — events created.'),
                onError: (e: any) => toast.error(e?.message || 'Venue already scheduled — adjust and retry.'),
              })
            }
          >
            {publish.isPending ? 'Publishing…' : 'Publish & create events'}
          </Button>
        </div>
      )}

      {bracket.status !== 'draft' && (
        <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          Every match {isSingleElim ? 'in the bracket' : 'below'} <strong className="font-medium text-gray-800">is a scheduled event</strong> — the
          same events on the Events page and in the mobile scoring app. When a match is scored,{' '}
          {isSingleElim ? 'click it and hit ' : 'hit '}
          <strong className="font-medium text-gray-800">Use result</strong> and the winner advances automatically (its event is renamed
          too). No score yet? Use <strong className="font-medium text-gray-800">Pick winner</strong> for a forfeit.
        </div>
      )}

      {isSingleElim ? (
        <BracketTree matches={bracket.matches as any} onMatchClick={setManageId} />
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4">
          {rounds.map((r) => (
            <div key={r.round} className="flex shrink-0 flex-col gap-4">
              <h2 className="text-sm font-semibold text-gray-700">{r.label}</h2>
              {r.matches.map((m) => (
                <MatchCard key={m.id} m={m} onAdvance={onAdvance} busy={advance.isPending} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Manage one match (single-elimination: click a match in the tree) */}
      <Dialog open={!!manageMatch} onOpenChange={(o) => !o && setManageId(null)}>
        <DialogContent className="max-w-sm">
          {manageMatch && (
            <>
              <DialogHeader>
                <DialogTitle>{manageMatch.stageLabel}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1 text-sm">
                  <TeamRow
                    name={manageMatch.homeTeam}
                    label={manageMatch.homeTeam ? abbr(manageMatch.homeTeam) : manageMatch.isBye ? 'BYE' : 'TBD'}
                    isWinner={!!manageMatch.winner && manageMatch.winner === manageMatch.homeTeam}
                    score={manageMatch.homeScore}
                  />
                  <TeamRow
                    name={manageMatch.awayTeam}
                    label={manageMatch.awayTeam ? abbr(manageMatch.awayTeam) : manageMatch.isBye ? 'BYE' : 'TBD'}
                    isWinner={!!manageMatch.winner && manageMatch.winner === manageMatch.awayTeam}
                    score={manageMatch.awayScore}
                  />
                </div>

                {(manageMatch.scheduledDate || manageMatch.venueName) && (
                  <div className="space-y-0.5 text-xs text-gray-400">
                    {manageMatch.scheduledDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {manageMatch.scheduledDate} {manageMatch.scheduledTime}
                      </div>
                    )}
                    {manageMatch.venueName && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {manageMatch.venueName}
                      </div>
                    )}
                  </div>
                )}

                {bracket.status === 'draft' ? (
                  <p className="text-xs text-gray-400">Publish the bracket to record results.</p>
                ) : (
                  <MatchActions m={manageMatch} onAdvance={onAdvance} busy={advance.isPending} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
