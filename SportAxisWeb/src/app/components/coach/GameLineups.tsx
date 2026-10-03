import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Lock, Users } from 'lucide-react';
import { useGameLineup, useSaveGameLineup } from '../../hooks/api';
import type { CoachLineupGame } from '../../services/api';
import { useDeptAbbreviator } from '../../utils/departments';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import Loading from '../Loading';

/**
 * The coach's side of play-by-play scoring (basketball, volleyball): for each
 * of their college's upcoming and ongoing games, who plays and under which
 * jersey number — and where the sport has positions, who takes each: the
 * volleyball rotation (I serves), a sepak takraw regu, chess board order. The
 * committee scores from the mobile app and can only credit these players,
 * so a game with no lineup can only be scored as team points.
 */

export function GameLineups({ games }: { games: CoachLineupGame[] }) {
  const abbr = useDeptAbbreviator();
  const [editing, setEditing] = useState<CoachLineupGame | null>(null);

  return (
    <section className="mb-10">
      <h2 className="t-section mb-1">Games</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Name who plays in each game. The committee scores from their phones and can only credit the players you line up.
      </p>

      <Card className="divide-y divide-border-subtle">
        {games.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate text-sm font-medium text-text">
                vs {g.opponent ? abbr(g.opponent) : 'TBD'}
                <span className="ml-2 font-normal text-text-muted">{g.category}</span>
              </p>
              <p className="text-xs text-text-secondary">
                {new Date(g.schedule).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {g.startTime ? ` · ${g.startTime}` : ''}
                {g.venueName ? ` · ${g.venueName}` : ''}
              </p>
            </div>
            {g.lineupCount > 0 ? (
              <Badge variant="success">{g.lineupCount} {g.lineupCount === 1 ? 'player' : 'players'}</Badge>
            ) : (
              <Badge variant="warning">No lineup yet</Badge>
            )}
            {g.status === 'ongoing' && <Badge variant="danger">Live</Badge>}
            <Button size="sm" variant={g.lineupCount > 0 ? 'secondary' : 'primary'} onClick={() => setEditing(g)} disabled={g.locked}>
              {g.locked ? <><Lock className="size-3.5" /> Final</> : g.lineupCount > 0 ? 'Edit lineup' : 'Set lineup'}
            </Button>
          </div>
        ))}
      </Card>

      {editing && <LineupDialog game={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

type Row = { on: boolean; jersey: string; name: string; hasPlays: boolean; position: number | null };

function LineupDialog({ game, onClose }: { game: CoachLineupGame; onClose: () => void }) {
  const abbr = useDeptAbbreviator();
  const lineupQ = useGameLineup(game.id);
  const saveMut = useSaveGameLineup();
  const [rows, setRows] = useState<Record<string, Row> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Everyone who could play: the current lineup plus the coach's eligible athletes.
  const initial = useMemo(() => {
    const data = lineupQ.data;
    if (!data) return null;
    const r: Record<string, Row> = {};
    for (const c of data.candidates) r[c.playerId] = { on: false, jersey: c.jerseyNumber ?? '', name: c.name, hasPlays: false, position: null };
    for (const p of data.players) r[p.playerId] = { on: true, jersey: p.jerseyNumber, name: p.name, hasPlays: p.hasPlays, position: p.rotationPosition };
    return r;
  }, [lineupQ.data]);

  useEffect(() => {
    if (initial && rows === null) setRows(initial);
  }, [initial, rows]);

  const set = (id: string, patch: Partial<Row>) => setRows((r) => (r ? { ...r, [id]: { ...r[id], ...patch } } : r));

  const entries = rows ? Object.entries(rows).sort(([, a], [, b]) => a.name.localeCompare(b.name)) : [];
  const chosen = entries.filter(([, r]) => r.on);
  const positions = lineupQ.data?.positions ?? [];
  const positionName = lineupQ.data?.positionName ?? 'Position';
  const isVolleyball = (lineupQ.data?.sport ?? game.sport) === 'volleyball';
  const max = lineupQ.data?.max ?? 20;

  /** Put a player in a position, moving whoever had it out. */
  const setPosition = (id: string, position: number | null) =>
    setRows((r) => {
      if (!r) return r;
      const next = { ...r };
      for (const [k, v] of Object.entries(next)) if (position && v.position === position) next[k] = { ...v, position: null };
      next[id] = { ...next[id], position };
      return next;
    });

  const save = () => {
    const players = chosen.map(([playerId, r]) => ({
      playerId,
      jerseyNumber: r.jersey.trim(),
      rotationPosition: positions.length ? r.position : null,
    }));
    if (players.length > max) {
      setError(`A lineup has at most ${max} players — ${players.length} ticked.`);
      return;
    }
    if (positions.length) {
      const filled = chosen.filter(([, r]) => r.position).length;
      if (filled !== 0 && filled !== positions.length) {
        setError(`${positionName} needs all ${positions.length} (${positions.join(', ')}) — ${filled} set. Or clear them all.`);
        return;
      }
    }
    const missing = chosen.find(([, r]) => !/^\d{1,2}$/.test(r.jersey.trim()));
    if (missing) {
      setError(`${missing[1].name} needs a jersey number from 0 to 99.`);
      return;
    }
    const seen = new Map<string, string>();
    for (const [, r] of chosen) {
      const other = seen.get(r.jersey.trim());
      if (other) {
        setError(`${other} and ${r.name} both have #${r.jersey.trim()}.`);
        return;
      }
      seen.set(r.jersey.trim(), r.name);
    }
    setError(null);
    saveMut.mutate(
      { eventId: game.id, players },
      {
        onSuccess: () => {
          toast.success('Lineup saved');
          onClose();
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lineup vs {game.opponent ? abbr(game.opponent) : 'TBD'}</DialogTitle>
          <DialogDescription>
            Tick who plays and check their jersey numbers. The number defaults to the athlete's profile and can differ for this game.
            {isVolleyball
              ? ' Put six players in the starting rotation — position I serves first. The scorer confirms it at the start of each set.'
              : positions.length > 0 && ` Give ${positions.length} players a ${positionName.toLowerCase()}: ${positions.join(', ')}.`}
            {` Up to ${max} players.`}
          </DialogDescription>
        </DialogHeader>

        {lineupQ.isLoading || !rows ? (
          <Loading fullScreen={false} message="Loading your roster" />
        ) : lineupQ.error ? (
          <p className="py-6 text-center text-sm text-danger-text">{lineupQ.error.message}</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Users className="size-8 text-text-muted" />
            <p className="mt-2 text-sm text-text-secondary">
              You have no active athletes in {game.category} yet. Add them to your roster first.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {entries.map(([id, r]) => (
              <li key={id} className="flex items-center gap-3 py-2">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-(--action)"
                    checked={r.on}
                    disabled={r.hasPlays}
                    onChange={(e) => set(id, { on: e.target.checked, ...(e.target.checked ? {} : { position: null }) })}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-text">{r.name}</span>
                    {r.hasPlays && <span className="block text-xs text-text-muted">Has plays in this game — stays in</span>}
                  </span>
                </label>
                <Input
                  aria-label={`Jersey number for ${r.name}`}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="#"
                  value={r.jersey}
                  disabled={!r.on || r.hasPlays}
                  onChange={(e) => set(id, { jersey: e.target.value.replace(/\D/g, '') })}
                  className="numeral h-11 w-16 text-center text-base"
                />
                {positions.length > 0 && (
                  <select
                    aria-label={`Starting position for ${r.name}`}
                    value={r.position ?? ''}
                    disabled={!r.on}
                    onChange={(e) => setPosition(id, e.target.value ? Number(e.target.value) : null)}
                    className="h-11 w-24 rounded-md border border-border bg-surface px-2 text-sm text-text disabled:opacity-50"
                  >
                    <option value="">Bench</option>
                    {positions.map((label, i) => (
                      <option key={label} value={i + 1}>{label}{isVolleyball && i === 0 ? ' (serve)' : ''}</option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-text-secondary">{chosen.length} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saveMut.isPending || !rows}>
              {saveMut.isPending ? 'Saving…' : 'Save lineup'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
