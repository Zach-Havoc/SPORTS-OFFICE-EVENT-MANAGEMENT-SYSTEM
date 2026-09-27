import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Flag, ListChecks, Undo2, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { applyScoreboard, qk, useEvent, useGameRoster, useGameScoreboard } from "../../hooks/api";
import {
  assignPlayPlayer,
  finishGame,
  recordPlay,
  saveGameRoster,
  setGamePeriod,
  undoLastPlay,
  type PlayType,
  type Scoreboard,
  type ScoreboardTeam,
} from "../../services/api";
import { isAssignedCommittee } from "../../utils/committee";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { EmptyState } from "../../components/page/EmptyState";
import Loading from "../../components/Loading";
import { cn } from "../../components/ui/utils";
import { FoulsLine, PlayLog, StatusPill } from "../../components/basketball/Scoreboard";
import { PLAY_LABEL, playText, playerTag, teamShort } from "../../components/basketball/format";

/**
 * The committee's play-by-play basketball scorer, built for a phone at the
 * scorer's table. Both teams sit side by side so nothing needs scrolling
 * mid-play: tap a jersey to select that player, then an action. A basket with
 * no player selected is recorded for the team and can be credited later from
 * the log; a foul always needs a player.
 *
 * The server computes the score. Every action returns the full scoreboard,
 * which replaces what's on screen.
 */

const ACTIONS: Array<{ type: PlayType; label: string }> = [
  { type: "FT", label: "+1 FT" },
  { type: "FG2", label: "+2" },
  { type: "FG3", label: "+3" },
  { type: "FOUL", label: "Foul" },
];

type PanelError = { teamId: string | null; message: string } | null;

export default function BasketballScoring() {
  const { eventId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const eventQ = useEvent(eventId);
  const boardQ = useGameScoreboard(eventId);
  const board = boardQ.data;

  const [selected, setSelected] = useState<{ teamId: string; playerId: string } | null>(null);
  const [error, setError] = useState<PanelError>(null);
  const [rosterTeamId, setRosterTeamId] = useState<string | null>(null);
  const [assigningPlay, setAssigningPlay] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [inFlight, setInFlight] = useState(0);

  useEffect(() => {
    if (!authLoading && (!user || !["judge", "admin"].includes(user.role))) navigate("/login");
  }, [user, authLoading, navigate]);

  /** Run one write, show its scoreboard, and surface a rejection inline. */
  const run = async (
    call: () => Promise<Scoreboard>,
    { teamId = null, done }: { teamId?: string | null; done?: (b: Scoreboard) => void } = {},
  ) => {
    setError(null);
    setInFlight((n) => n + 1);
    try {
      const next = await call();
      applyScoreboard(qc, next);
      done?.(next);
      return next;
    } catch (e) {
      setError({ teamId, message: e instanceof Error ? e.message : "That didn't go through. Try again." });
      return null;
    } finally {
      setInFlight((n) => n - 1);
    }
  };

  const undo = () =>
    run(() => undoLastPlay(eventId!), { done: () => toast("Last play undone") });

  const record = (team: ScoreboardTeam, type: PlayType) => {
    const playerId = selected?.teamId === team.id ? selected.playerId : null;
    if (type === "FOUL" && !playerId) {
      setError({ teamId: team.id, message: "Pick a player first" });
      return;
    }
    const player = team.players.find((p) => p.playerId === playerId);
    setSelected(null);
    run(() => recordPlay(eventId!, { teamId: team.id, type, playerId }), {
      teamId: team.id,
      done: () =>
        toast.success(
          `Recorded: ${player ? playerTag(player.jersey, player.name) : teamShort(team)} ${PLAY_LABEL[type]}`,
          { action: { label: "Undo", onClick: undo }, duration: 4000 },
        ),
    });
  };

  const changePeriod = (to: number) =>
    run(() => setGamePeriod(eventId!, to), { done: (b) => toast(`${b.periodLabel} started`) });

  if (authLoading || boardQ.isLoading || eventQ.isLoading) {
    return <Loading fullScreen={false} message="Loading the scoreboard" />;
  }

  if (eventQ.data && !isAssignedCommittee(eventQ.data, user)) {
    return (
      <Shell>
        <Card>
          <EmptyState
            icon={Users}
            title="You aren't scoring this game"
            description="Only the committee member the Sports Office assigned to this game, or an admin, can record plays."
            action={<Button asChild variant="secondary"><Link to="/judge">Back to your games</Link></Button>}
          />
        </Card>
      </Shell>
    );
  }

  if (!board) {
    return (
      <Shell>
        <Card>
          <EmptyState
            title="Couldn't load this game"
            description={boardQ.error?.message}
            action={<Button variant="secondary" onClick={() => boardQ.refetch()}>Try again</Button>}
          />
        </Card>
      </Shell>
    );
  }

  if (!board.ready) {
    return (
      <Shell title={board.eventName}>
        <Card>
          <EmptyState
            title="This game isn't set up for play-by-play"
            description="It needs exactly two colleges. Ask the Sports Office to check the event's teams."
          />
        </Card>
      </Shell>
    );
  }

  const finished = board.status === "finished";
  const [home, away] = board.teams;
  const reg = board.rules.regulationPeriods;
  const tied = home.score === away.score;
  const nextPeriodBlocked = board.period >= reg && !tied;
  const winner = board.teams.find((t) => t.id === board.winnerTeamId);

  return (
    <Shell title={board.eventName} status={<StatusPill board={board} />}>
      {finished && winner && (
        <div className="mb-3 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-text">
          Final. <strong>{winner.label}</strong> won {Math.max(home.score, away.score)}–{Math.min(home.score, away.score)}.
          You can still credit unassigned points below.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {board.teams.map((team) => (
          <TeamPanel
            key={team.id}
            team={team}
            board={board}
            finished={finished}
            selectedPlayerId={selected?.teamId === team.id ? selected.playerId : null}
            onSelect={(playerId) => {
              setError(null);
              setSelected((s) => (s?.playerId === playerId ? null : { teamId: team.id, playerId }));
            }}
            onAction={(type) => record(team, type)}
            onEditRoster={() => setRosterTeamId(team.id)}
            error={error?.teamId === team.id ? error.message : null}
          />
        ))}
      </div>

      {error && error.teamId === null && (
        <p role="alert" className="mt-3 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-text">
          {error.message}
        </p>
      )}

      {/* Needs a player */}
      {board.unassignedPlays.length > 0 && (
        <section className="mt-6">
          <h2 className="t-section mb-2">Needs a player ({board.unassignedPlays.length})</h2>
          <Card className="divide-y divide-border-subtle px-3">
            {board.unassignedPlays.map((play) => {
              const team = board.teams.find((t) => t.id === play.teamId)!;
              const open = assigningPlay === play.id;
              return (
                <div key={play.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <span className="numeral w-10 text-xs text-text-muted">{play.periodLabel}</span>
                    <span className="flex-1 text-sm text-text">{playText(play, board)}</span>
                    <Button size="sm" variant={open ? "ghost" : "secondary"} onClick={() => setAssigningPlay(open ? null : play.id)}>
                      {open ? "Cancel" : "Assign"}
                    </Button>
                  </div>
                  {open && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {team.players.length === 0 && (
                        <span className="text-sm text-text-muted">Add {teamShort(team)}'s roster first.</span>
                      )}
                      {team.players.map((p) => (
                        <button
                          key={p.playerId}
                          type="button"
                          onClick={() =>
                            run(() => assignPlayPlayer(eventId!, play.id, p.playerId), {
                              done: () => {
                                setAssigningPlay(null);
                                toast.success(`Credited to ${playerTag(p.jersey, p.name)}`);
                              },
                            })
                          }
                          className="min-h-11 min-w-11 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-text hover:bg-surface-hover active:bg-surface-active"
                        >
                          <span className="numeral">#{p.jersey}</span>{" "}
                          <span className="text-text-secondary">{p.name.split(" ").pop()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      )}

      <section className="mt-6">
        <h2 className="t-section mb-2">Recent plays</h2>
        <Card className="px-3">
          <PlayLog board={board} />
        </Card>
      </section>

      {/* Game controls — pinned to the bottom, within thumb reach. */}
      {!finished && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="lg" onClick={undo} disabled={board.recentPlays.length === 0} className="px-3">
              <Undo2 className="size-4" />
              Undo
            </Button>

            <div className="mx-auto flex items-center gap-1" aria-label="Period">
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label="Previous period"
                disabled={board.period <= 1}
                onClick={() => changePeriod(board.period - 1)}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <span className="numeral min-w-10 text-center text-lg text-text">{board.periodLabel}</span>
              <Button
                variant="secondary"
                size="lg"
                className="px-3"
                disabled={nextPeriodBlocked}
                title={nextPeriodBlocked ? "Overtime only follows a tie" : undefined}
                onClick={() => changePeriod(board.period + 1)}
              >
                {periodName(board.period + 1, reg)}
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <Button size="lg" className="px-3" onClick={() => setConfirmFinish(true)}>
              <Flag className="size-4" />
              Finish
            </Button>
          </div>
          <p className="mt-1 h-4 text-center text-xs text-text-muted" aria-live="polite">
            {inFlight > 0 ? "Saving…" : boardQ.isRefetching ? "Syncing…" : ""}
          </p>
        </div>
      )}

      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish this game?</AlertDialogTitle>
            <AlertDialogDescription>
              {tied
                ? `It's tied ${home.score}–${away.score}. A tied game can't be finished; start ${periodName(board.period + 1, reg)} instead.`
                : `${(home.score > away.score ? home : away).label} wins ${Math.max(home.score, away.score)}–${Math.min(home.score, away.score)}. The result goes to the standings and bracket, and no more plays can be recorded.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            {!tied && (
              <AlertDialogAction
                onClick={() => run(() => finishGame(eventId!), { done: () => toast.success("Game finished") })}
              >
                Finish game
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rosterTeamId && (
        <RosterDialog
          eventId={eventId!}
          teamId={rosterTeamId}
          onClose={() => setRosterTeamId(null)}
        />
      )}
    </Shell>
  );
}

function periodName(period: number, reg: number): string {
  return period <= reg ? `Q${period}` : `OT${period - reg}`;
}

function Shell({ title, status, children }: { title?: string; status?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="page-container px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-3 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to your games">
          <Link to="/judge"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-text">{title ?? "Play-by-play"}</h1>
        {status}
      </div>
      {children}
    </div>
  );
}

function TeamPanel({
  team,
  board,
  finished,
  selectedPlayerId,
  onSelect,
  onAction,
  onEditRoster,
  error,
}: {
  team: ScoreboardTeam;
  board: Scoreboard;
  finished: boolean;
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
  onAction: (type: PlayType) => void;
  onEditRoster: () => void;
  error: string | null;
}) {
  const limit = board.rules.foulOutLimit;

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-2.5 sm:p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text" title={team.name}>{teamShort(team)}</p>
          <FoulsLine team={team} className="mt-0.5 flex-wrap" />
        </div>
        <span className="numeral text-4xl leading-none text-text sm:text-5xl" aria-label={`${teamShort(team)} score`}>
          {team.score}
        </span>
      </header>

      {team.players.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-text-secondary">
          No roster yet. Team points still count.
          {!finished && (
            <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={onEditRoster}>
              <ListChecks className="size-4" /> Add roster
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {team.players.map((p) => {
            const isSel = selectedPlayerId === p.playerId;
            return (
              <button
                key={p.playerId}
                type="button"
                disabled={p.fouledOut || finished}
                aria-pressed={isSel}
                aria-label={`#${p.jersey} ${p.name}, ${p.pf} fouls${p.fouledOut ? ", fouled out" : ""}`}
                onClick={() => onSelect(p.playerId)}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center rounded-md border px-1 transition-colors duration-[90ms] select-none",
                  "[touch-action:manipulation] [-webkit-tap-highlight-color:transparent]",
                  isSel
                    ? "border-action bg-action text-action-on"
                    : "border-border bg-surface text-text active:bg-surface-active",
                  p.fouledOut && "border-dashed bg-surface-sunken text-text-disabled line-through",
                )}
              >
                <span className="numeral text-xl leading-none">{p.jersey}</span>
                <span className={cn("mt-0.5 w-full truncate text-[0.6875rem] leading-tight", isSel ? "text-action-on/80" : "text-text-muted")}>
                  {p.name.split(" ").pop()}
                </span>
                {p.pf > 0 && (
                  <span
                    className={cn(
                      "absolute top-0.5 right-1 text-[0.625rem] font-semibold",
                      isSel ? "text-action-on/80" : p.pf >= limit - 1 ? "text-danger-text" : "text-text-muted",
                    )}
                  >
                    {p.pf}F
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!finished && (
        <>
          <div className="mt-auto grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
            {ACTIONS.map((a) => (
              <Button
                key={a.type}
                variant={a.type === "FOUL" ? "secondary" : "primary"}
                className="h-14 text-base [touch-action:manipulation]"
                onClick={() => onAction(a.type)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-danger-border bg-danger-subtle px-2 py-1.5 text-xs text-danger-text">
              {error}
            </p>
          )}
          {team.players.length > 0 && (
            <button type="button" onClick={onEditRoster} className="self-start text-xs text-text-secondary underline underline-offset-2">
              Edit roster
            </button>
          )}
        </>
      )}
    </Card>
  );
}

type RosterRow = { on: boolean; jersey: string; starter: boolean; name: string };

function RosterDialog({ eventId, teamId, onClose }: { eventId: string; teamId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const rosterQ = useGameRoster(eventId);
  const team = rosterQ.data?.teams.find((t) => t.id === teamId);
  const [rows, setRows] = useState<Record<string, RosterRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Everyone who could play: the current roster plus eligible athletes.
  const initial = useMemo(() => {
    if (!team) return null;
    const r: Record<string, RosterRow> = {};
    for (const c of team.candidates) r[c.playerId] = { on: false, jersey: "", starter: false, name: c.name };
    for (const p of team.players) r[p.playerId] = { on: true, jersey: p.jerseyNumber, starter: p.isStarter, name: p.name };
    return r;
  }, [team]);

  useEffect(() => {
    if (initial && rows === null) setRows(initial);
  }, [initial, rows]);

  const set = (id: string, patch: Partial<RosterRow>) =>
    setRows((r) => (r ? { ...r, [id]: { ...r[id], ...patch } } : r));

  const save = async () => {
    if (!rows) return;
    const players = Object.entries(rows)
      .filter(([, r]) => r.on)
      .map(([playerId, r]) => ({ playerId, jerseyNumber: r.jersey.trim(), isStarter: r.starter }));
    if (players.some((p) => !/^\d{1,2}$/.test(p.jerseyNumber))) {
      setError("Every selected player needs a jersey number from 0 to 99.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      applyScoreboard(qc, await saveGameRoster(eventId, teamId, players));
      qc.invalidateQueries({ queryKey: qk.gameRoster(eventId) });
      toast.success("Roster saved");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the roster.");
    } finally {
      setSaving(false);
    }
  };

  const entries = rows ? Object.entries(rows).sort(([, a], [, b]) => a.name.localeCompare(b.name)) : [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{team ? `${team.name} roster` : "Roster"}</DialogTitle>
          <DialogDescription>
            Pick who's playing and enter their jersey numbers. Only these players can be credited with plays.
          </DialogDescription>
        </DialogHeader>

        {rosterQ.isLoading || !rows ? (
          <Loading fullScreen={false} message="Loading athletes" />
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No active athletes in this college for {rosterQ.data ? "this sport" : "this game"} yet.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {entries.map(([id, r]) => (
              <li key={id} className="flex items-center gap-3 py-2">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-[--action]"
                    checked={r.on}
                    onChange={(e) => set(id, { on: e.target.checked })}
                  />
                  <span className="truncate text-sm text-text">{r.name}</span>
                </label>
                <Input
                  aria-label={`Jersey number for ${r.name}`}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="#"
                  value={r.jersey}
                  disabled={!r.on}
                  onChange={(e) => set(id, { jersey: e.target.value.replace(/\D/g, "") })}
                  className="numeral h-11 w-16 text-center text-base"
                />
                <label className="flex min-h-11 items-center gap-1.5 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    className="size-4 accent-[--action]"
                    checked={r.starter}
                    disabled={!r.on}
                    onChange={(e) => set(id, { starter: e.target.checked })}
                  />
                  Starter
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !rows}>{saving ? "Saving…" : "Save roster"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
