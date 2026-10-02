/**
 * Turning an event + whatever result data exists for it into the two sides of
 * a scoreboard, and tallying each college's win–loss record.
 */

export interface MatchRow {
  eventId: string | null;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | string | null;
  awayScore: number | string | null;
  winner: string | null;
  isDraw?: boolean;
  status: 'scheduled' | 'completed' | 'forfeit';
}

export interface LiveRow {
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  period: string | null;
  status: 'scheduled' | 'in_progress' | 'final';
  method?: 'live' | 'paper';
}

export interface Side {
  team: string;
  score: number | null;
}

export interface Scoreboard {
  home: Side;
  away: Side;
  /** 'home' / 'away' when decided, 'draw' on a tie, null while undecided. */
  winner: 'home' | 'away' | 'draw' | null;
  live: boolean;
  /** Under way, scored on the paper sheet: no running score to show. */
  onPaper: boolean;
  period: string | null;
}

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === '' ? null : Number(v);

/**
 * The scoreboard for a two-college game. A running live score wins, then the
 * recorded head-to-head result, and with neither the two colleges face off
 * without scores (an upcoming game).
 */
export function scoreboardFor(
  departments: string[],
  live?: LiveRow | null,
  match?: MatchRow | null,
): Scoreboard {
  if (live && live.status === 'in_progress' && live.method === 'paper') {
    return {
      home: { team: live.homeTeam ?? departments[0] ?? 'Home', score: null },
      away: { team: live.awayTeam ?? departments[1] ?? 'Away', score: null },
      winner: null,
      live: false,
      onPaper: true,
      period: null,
    };
  }

  if (live && (live.status === 'in_progress' || live.status === 'final')) {
    const final = live.status === 'final';
    return {
      home: { team: live.homeTeam ?? departments[0] ?? 'Home', score: live.homeScore },
      away: { team: live.awayTeam ?? departments[1] ?? 'Away', score: live.awayScore },
      winner: final ? decide(live.homeScore, live.awayScore) : null,
      live: !final,
      onPaper: false,
      period: final ? null : live.period,
    };
  }

  if (match && match.status !== 'scheduled') {
    const h = num(match.homeScore);
    const a = num(match.awayScore);
    const winner = match.isDraw
      ? 'draw'
      : match.winner === match.homeTeam
        ? 'home'
        : match.winner === match.awayTeam
          ? 'away'
          : h !== null && a !== null
            ? decide(h, a)
            : null;
    return {
      home: { team: match.homeTeam, score: h },
      away: { team: match.awayTeam, score: a },
      winner,
      live: false,
      onPaper: false,
      period: null,
    };
  }

  return {
    home: { team: departments[0] ?? 'TBA', score: null },
    away: { team: departments[1] ?? 'TBA', score: null },
    winner: null,
    live: false,
    onPaper: false,
    period: null,
  };
}

/**
 * What the public is told about a game:
 *   live           the committee is scoring it in the app (running score)
 *   in_progress    under way without a running score: scored on paper, or
 *                  its start time has passed today and nobody started it
 *   upcoming       not started yet
 *   result_pending an earlier day, and no result has been recorded
 *   completed      a result is recorded (live or from the scanned sheet;
 *                  they look the same)
 */
export type GameState = 'live' | 'in_progress' | 'upcoming' | 'result_pending' | 'completed';

export function gameState(
  event: { status: string; schedule?: string | null; startTime?: string | null; departments?: string[] },
  live?: LiveRow | null,
  match?: MatchRow | null,
  now: Date = new Date(),
): GameState {
  if (event.status === 'completed' || live?.status === 'final') return 'completed';
  if (match && match.status !== 'scheduled') return 'completed';
  if (live?.status === 'in_progress') return live.method === 'paper' ? 'in_progress' : 'live';

  const day = String(event.schedule ?? '').slice(0, 10);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (day && day < today) return 'result_pending';

  // A judged event (more than two colleges) marked ongoing has live rankings.
  if (event.status === 'ongoing') return (event.departments ?? []).length > 2 ? 'live' : 'in_progress';

  if (day === today && event.startTime) {
    const [h, m] = event.startTime.split(':').map(Number);
    if (!Number.isNaN(h) && now.getHours() * 60 + now.getMinutes() >= h * 60 + (m || 0)) return 'in_progress';
  }
  return 'upcoming';
}

function decide(h: number, a: number): 'home' | 'away' | 'draw' {
  return h > a ? 'home' : a > h ? 'away' : 'draw';
}

export interface Record3 {
  w: number;
  l: number;
  d: number;
}

/** "5-2", or "5-2-1" once a draw has happened. */
export const formatRecord = (r?: Record3) => (r ? (r.d ? `${r.w}-${r.l}-${r.d}` : `${r.w}-${r.l}`) : '');

/**
 * Each college's record per sport, from decided head-to-head results.
 * Keyed `${sport}|${team}`; `include` narrows which matches count (e.g. only
 * the selected season's).
 */
export function recordsBySport(
  matches: MatchRow[],
  include: (m: MatchRow) => boolean = () => true,
): Map<string, Record3> {
  const out = new Map<string, Record3>();
  const bump = (sport: string, team: string, k: keyof Record3) => {
    const key = `${sport}|${team}`;
    const r = out.get(key) ?? { w: 0, l: 0, d: 0 };
    r[k] += 1;
    out.set(key, r);
  };

  for (const m of matches) {
    if (m.status === 'scheduled' || !include(m)) continue;
    if (m.isDraw) {
      bump(m.sport, m.homeTeam, 'd');
      bump(m.sport, m.awayTeam, 'd');
    } else if (m.winner === m.homeTeam || m.winner === m.awayTeam) {
      const loser = m.winner === m.homeTeam ? m.awayTeam : m.homeTeam;
      bump(m.sport, m.winner, 'w');
      bump(m.sport, loser, 'l');
    }
  }
  return out;
}
