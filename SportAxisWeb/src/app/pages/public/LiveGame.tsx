import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useGameScoreboard } from "../../hooks/api";
import Loading from "../../components/Loading";
import { TeamLogo } from "../../components/public/TeamLogo";
import { cn } from "../../components/ui/utils";
import {
  BoxScore,
  FoulsLine,
  LineScore,
  PlayLog,
  StatusPill,
} from "../../components/basketball/Scoreboard";
import { teamShort } from "../../components/basketball/format";

/**
 * One basketball game, live: score, period, team fouls and bonus, line score,
 * box score and the latest plays. Pushed over the `live-scores.{id}` socket
 * (full state each time) and refetched on reconnect, so it needs no refresh.
 */
export default function PublicLiveGame() {
  const { eventId } = useParams();
  const { data: board, isLoading, error } = useGameScoreboard(eventId);
  const [boxTeam, setBoxTeam] = useState(0);

  if (isLoading) {
    return (
      <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
        <Loading fullScreen={false} message="Loading the game" />
      </div>
    );
  }

  if (!board || !board.ready) {
    return (
      <div className="page-container px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-text">
          {error ? "This game couldn't be loaded." : "There's no box score for this game."}
        </p>
        <Link to="/live" className="mt-3 inline-block text-sm text-brand-text underline underline-offset-4">
          Back to live scores
        </Link>
      </div>
    );
  }

  const [home, away] = board.teams;
  const winner = board.winnerTeamId;

  return (
    <div className="page-container px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link to="/live" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text">
        <ArrowLeft className="size-4" /> Live scores
      </Link>

      {/* Scoreboard */}
      <section className="rounded-2xl border border-border bg-surface px-4 py-5 sm:px-8 sm:py-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-text sm:text-xl">{board.eventName}</h1>
            <p className="text-sm text-text-secondary">
              {board.category}
              {board.venueName ? ` · ${board.venueName}` : ""}
            </p>
          </div>
          <StatusPill board={board} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          {[home, away].map((team, i) => (
            <div
              key={team.id}
              className={cn("flex min-w-0 flex-col items-center gap-2 text-center", i === 1 && "col-start-3")}
            >
              <TeamLogo name={team.name} logoUrl={team.logoUrl} label={teamShort(team)} size={56} />
              <p className="w-full truncate text-sm font-medium text-text" title={team.name}>{teamShort(team)}</p>
              <p
                className={cn(
                  "numeral text-5xl leading-none sm:text-7xl",
                  winner && winner !== team.id ? "text-text-muted" : "text-text",
                )}
              >
                {team.score}
              </p>
              {board.status !== "scheduled" && <FoulsLine team={team} className="justify-center" />}
            </div>
          ))}
          <span className="col-start-2 row-start-1 text-2xl text-text-muted" aria-hidden>–</span>
        </div>
      </section>

      {board.status === "scheduled" ? (
        <p className="mt-6 text-center text-sm text-text-secondary">
          The game hasn't started. The score will update here on its own once it does.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-6">
            <section>
              <h2 className="t-section mb-2">By period</h2>
              <div className="rounded-xl border border-border bg-surface px-4 py-2">
                <LineScore board={board} />
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="t-section">Box score</h2>
                <div role="tablist" className="flex rounded-md border border-border p-0.5">
                  {board.teams.map((t, i) => (
                    <button
                      key={t.id}
                      role="tab"
                      type="button"
                      aria-selected={boxTeam === i}
                      onClick={() => setBoxTeam(i)}
                      className={cn(
                        "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                        boxTeam === i ? "bg-action text-action-on" : "text-text-secondary hover:text-text",
                      )}
                    >
                      {teamShort(t)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-2">
                <BoxScore team={board.teams[boxTeam]} foulOutLimit={board.rules.foulOutLimit} />
              </div>
            </section>
          </div>

          <section>
            <h2 className="t-section mb-2">Latest plays</h2>
            <div className="rounded-xl border border-border bg-surface px-4">
              <PlayLog board={board} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
