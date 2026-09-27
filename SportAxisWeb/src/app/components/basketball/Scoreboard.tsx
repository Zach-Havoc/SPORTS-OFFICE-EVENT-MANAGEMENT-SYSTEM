import type { Play, Scoreboard, ScoreboardTeam } from "../../services/api";
import { cn } from "../ui/utils";
import { playText, teamShort } from "./format";

/**
 * Read-only pieces of a play-by-play basketball scoreboard, shared by the
 * public live game page and the committee's scorer. Everything here renders
 * the server's computed state; nothing is derived client-side except text.
 */

export function StatusPill({ board }: { board: Scoreboard }) {
  if (board.status === "finished") {
    return (
      <span className="rounded-sm border border-border bg-surface-sunken px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Final{board.period > board.rules.regulationPeriods ? `/${board.periodLabel}` : ""}
      </span>
    );
  }
  if (board.status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-danger-border bg-danger-subtle px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-danger-text">
        <span className="size-1.5 rounded-full bg-danger motion-safe:animate-pulse" aria-hidden />
        Live · {board.periodLabel}
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-border px-1.5 py-0.5 text-xs font-medium text-text-secondary">
      Not started
    </span>
  );
}

export function FoulsLine({ team, className }: { team: ScoreboardTeam; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-text-secondary", className)}>
      <span>
        Team fouls <span className="numeral text-text">{team.teamFouls}</span>
      </span>
      {team.inBonus && (
        <span
          className="rounded-sm border border-warning-border bg-warning-subtle px-1.5 py-0.5 font-semibold uppercase tracking-wide text-warning-foreground"
          title="Their next foul sends the other team to the free-throw line"
        >
          Bonus
        </span>
      )}
    </div>
  );
}

/** Points per period, one row per team — the classic line score. */
export function LineScore({ board }: { board: Scoreboard }) {
  const periods = board.teams[0]?.periodScores ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-text-muted">
            <th className="py-1.5 pr-3 text-left font-medium">Team</th>
            {periods.map((p) => (
              <th key={p.period} className={cn("px-2 py-1.5 text-right font-medium", p.period === board.period && board.status === "live" && "text-text")}>
                {p.label}
              </th>
            ))}
            <th className="py-1.5 pl-3 text-right font-semibold text-text">T</th>
          </tr>
        </thead>
        <tbody className="numeral">
          {board.teams.map((t) => (
            <tr key={t.id} className="border-t border-border-subtle">
              <td className="py-2 pr-3 font-sans font-medium text-text" title={t.name}>{teamShort(t)}</td>
              {t.periodScores.map((p) => (
                <td key={p.period} className="px-2 py-2 text-right text-text-secondary">
                  {p.period > board.period ? "–" : p.points}
                </td>
              ))}
              <td className="py-2 pl-3 text-right text-text">{t.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoxScore({ team, foulOutLimit }: { team: ScoreboardTeam; foulOutLimit: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <thead>
          <tr className="text-xs text-text-muted">
            <th className="w-10 py-1.5 text-left font-medium">#</th>
            <th className="py-1.5 text-left font-medium">Player</th>
            <th className="px-2 py-1.5 text-right font-medium" title="Points">PTS</th>
            <th className="px-2 py-1.5 text-right font-medium" title="2-point field goals">2PT</th>
            <th className="px-2 py-1.5 text-right font-medium" title="3-point field goals">3PT</th>
            <th className="px-2 py-1.5 text-right font-medium" title="Free throws made">FT</th>
            <th className="py-1.5 pl-2 text-right font-medium" title="Personal fouls">PF</th>
          </tr>
        </thead>
        <tbody>
          {team.players.map((p) => (
            <tr key={p.playerId} className={cn("border-t border-border-subtle", p.fouledOut && "text-text-muted")}>
              <td className="numeral py-2">{p.jersey}</td>
              <td className="py-2 pr-2">
                <span className={cn("text-text", p.fouledOut && "text-text-muted line-through")}>{p.name}</span>
                {p.isStarter && <span className="ml-1.5 text-xs text-text-muted" title="Starter">S</span>}
              </td>
              <td className="numeral px-2 py-2 text-right text-text">{p.pts}</td>
              <td className="numeral px-2 py-2 text-right">{p.fg2}</td>
              <td className="numeral px-2 py-2 text-right">{p.fg3}</td>
              <td className="numeral px-2 py-2 text-right">{p.ft}</td>
              <td className={cn("numeral py-2 pl-2 text-right", p.pf >= foulOutLimit - 1 && "font-semibold text-danger-text")}>
                {p.pf}
              </td>
            </tr>
          ))}
          {team.unassignedPoints > 0 && (
            <tr className="border-t border-border-subtle text-text-muted">
              <td />
              <td className="py-2 italic">Not yet credited</td>
              <td className="numeral px-2 py-2 text-right">{team.unassignedPoints}</td>
              <td colSpan={4} />
            </tr>
          )}
          {team.players.length === 0 && team.unassignedPoints === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-text-muted">No roster yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PlayLog({ board, plays }: { board: Scoreboard; plays?: Play[] }) {
  const list = plays ?? board.recentPlays;
  if (list.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">No plays yet.</p>;
  }
  return (
    <ol className="divide-y divide-border-subtle">
      {list.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
          <span className="numeral w-10 shrink-0 text-xs text-text-muted">{p.gameClock ?? p.periodLabel}</span>
          <span className={cn("min-w-0 flex-1 truncate", p.type === "FOUL" ? "text-text-secondary" : "text-text")}>
            {playText(p, board)}
          </span>
        </li>
      ))}
    </ol>
  );
}
