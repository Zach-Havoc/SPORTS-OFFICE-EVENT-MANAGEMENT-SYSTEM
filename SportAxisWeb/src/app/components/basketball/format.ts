import type { Play, Scoreboard, ScoreboardTeam } from "../../services/api";

/** Text for play-by-play basketball: how plays, players and teams are named. */

export const PLAY_LABEL: Record<Play["type"], string> = {
  FG2: "+2",
  FG3: "+3",
  FT: "+1 FT",
  FOUL: "Foul",
};

export function teamShort(team: ScoreboardTeam): string {
  return team.abbreviation || team.label || team.name;
}

/** "#7 Santos" — last name only, the way a scorer calls it. */
export function playerTag(jersey: string | null, name: string | null): string {
  if (!jersey) return "Unassigned";
  const last = (name ?? "").trim().split(/\s+/).pop();
  return last ? `#${jersey} ${last}` : `#${jersey}`;
}

/** "#7 Santos +3", "CHH +2 (unassigned)", "#4 Cruz foul". */
export function playText(play: Play, board: Scoreboard): string {
  const team = board.teams.find((t) => t.id === play.teamId);
  const who = play.jersey ? playerTag(play.jersey, play.playerName) : `${team ? teamShort(team) : "Team"}`;
  if (play.type === "FOUL") return `${who} foul`;
  return `${who} ${PLAY_LABEL[play.type]}${play.jersey ? "" : " (unassigned)"}`;
}
