// ─────────────────────────────────────────────────────────────────────────────
// SportAxisApp — Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'coach' | 'athlete' | 'judge';
  // Athlete-only, populated from the registrar record at signup.
  department?: string | null;
  course?: string | null;
  yearLevel?: string | null;
  srCode?: string | null;
  privacyNoticeAcceptedAt?: string | null;
  privacyNoticeVersion?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

export type UserRole = User['role'];

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  registrationCode: string;
  srCode?: string;
  privacyNoticeAccepted: boolean;
}

// ── Notifications ────────────────────────────────────────────────────────────

// The backend's real notification classes (App\Notifications\*) each set their
// own `kind` string (see app/Notifications/*.php) — there's no generic
// info/success/warning/error taxonomy. Keep the known ones for autocomplete,
// but accept any string: the UI must render an unrecognized kind safely
// rather than assume this list is exhaustive.
export type NotificationKind =
  | 'protest_filed'
  | 'protest_resolved'
  | 'requirement_reviewed'
  | 'score_disputed'
  | 'committee_assigned'
  | 'schedule_changed'
  | (string & {});

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

// ── Event ────────────────────────────────────────────────────────────────────

/**
 * Matches the shape returned by GET /api/events and GET /api/events/{id}
 * (the EventController::toApiFormat() method).
 */
/** An assigned committee member, as the public event payloads expose it. */
export interface CommitteeMember {
  id: string | null;
  name: string | null;
}

export interface EventSummary {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime: string;
  endTime: string;
  venueId: string | null;
  venueName: string | null;
  departments: string[];
  judges: CommitteeMember[];
  status: 'upcoming' | 'ongoing' | 'completed';
  qrToken: string;
  createdAt: string;
}

export interface EventSession {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime: string;
  endTime: string;
  venueName: string | null;
  departments: string[];
  judges: CommitteeMember[];
  status: 'upcoming' | 'ongoing' | 'completed';
  qrToken: string;
}

export interface EventSessionResponse {
  event: EventSession;
}

// ── Scores ───────────────────────────────────────────────────────────────────

export type ScoringMethod = 'manual' | 'ocr';

// ── Live game score ──────────────────────────────────────────────────────────

export type LiveStatus = 'scheduled' | 'in_progress' | 'final';

export interface LiveScore {
  eventId: string;
  sport: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  period: string | null;
  detail: Record<string, unknown>;
  status: LiveStatus;
  version: number;
  updatedBy: string | null;
  startedAt: string | null;
  finalizedAt: string | null;
  updatedAt: string | null;
}

export interface LiveScorePush {
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeScore?: number;
  awayScore?: number;
  period?: string | null;
  detail?: Record<string, unknown>;
  status?: LiveStatus;
  version?: number;
}

export interface ScorePayload {
  eventId: string;
  department: string;
  judgeId: string;
  judgeName: string;
  totalScore: number;
  method: ScoringMethod;
  image_url?: string | null;
  submittedViaQr: boolean;
}

export interface ScoreSubmissionResponse {
  score: {
    id: string;
    event_id: string;
    department: string;
    judge_id: string;
    total_score: number;
    method: ScoringMethod;
  };
  message: string;
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OcrDepartmentScore {
  department: string;
  score: number;
  confidence: number;
}

export interface OcrResult {
  scores: OcrDepartmentScore[];
  image_url: string | null;
  notes: string;
  is_mock: boolean;
}

// ── Offline Queue ─────────────────────────────────────────────────────────────

export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed';

export interface OfflineQueueItem {
  id: string;               // local UUID
  payload: ScorePayload;
  status: OfflineQueueStatus;
  created_at: string;       // ISO timestamp
  retry_count: number;
  error?: string | null;
}

// ── QR Payload ────────────────────────────────────────────────────────────────

export interface QrPayload {
  eventId?: string;
  token?: string;
  // Support both formats: raw token string or structured object
  qr_token?: string;
}

// ── API Error ─────────────────────────────────────────────────────────────────

export interface ApiError {
  code?: string;
  error?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// ── Play-by-play basketball ──────────────────────────────────────────────────
// The server computes everything from the recorded plays; every call returns
// the whole scoreboard (see BasketballGameController on the backend).

/** A TIMEOUT is the team's and scores nothing. */
export type PlayType = 'FG2' | 'FG3' | 'FT' | 'FOUL' | 'TIMEOUT';

export interface BoxScoreRow {
  playerId: string;
  jersey: string;
  name: string;
  pts: number;
  fg2: number;
  fg3: number;
  ft: number;
  pf: number;
}

export interface ScoreboardTeam {
  id: string;
  side: 'home' | 'away';
  name: string;
  /** The college as the event names it. */
  label: string;
  abbreviation: string | null;
  logoUrl: string | null;
  score: number;
  periodScores: { period: number; label: string; points: number }[];
  teamFouls: number;
  /** FIBA time-outs in the current window: 2 in the 1st half, 3 in the 2nd, 1 per overtime. */
  timeoutsAllowed: number;
  timeoutsLeft: number;
  /** "1st half", "2nd half", "OT1"… */
  timeoutWindow: string;
  unassignedPoints: number;
  players: BoxScoreRow[];
}

export interface Play {
  id: number;
  teamId: string;
  playerId: string | null;
  jersey: string | null;
  playerName: string | null;
  type: PlayType;
  points: number;
  period: number;
  periodLabel: string;
  /** The game clock when it was recorded ("09:27" left), if the scorer's clock was on. */
  gameClock: string | null;
  createdAt: string;
}

export interface Scoreboard {
  eventId: string;
  eventName: string;
  category: string;
  version: number;
  status: 'scheduled' | 'live' | 'finished';
  period: number;
  periodLabel: string;
  regulationPeriods: number;
  /** False when the event doesn't name two known colleges. */
  ready: boolean;
  winnerTeamId: string | null;
  playCount: number;
  teams: ScoreboardTeam[];
  recentPlays: Play[];
  updatedAt: string | null;
}

// ── Play-by-play volleyball ──────────────────────────────────────────────────
// Replayed server-side from the rally log (see VolleyballMatch on the
// backend); every call returns the whole scoreboard.

export type VolleyballPointType = 'KILL' | 'ACE' | 'BLOCK' | 'OPP_ERROR';
export type VolleyballPlayType = VolleyballPointType | 'TIMEOUT' | 'SUB' | 'SET_START';

export interface VolleyballPlayer {
  playerId: string;
  jersey: string;
  name: string;
  onCourt: boolean;
  /** 1 (I, serving position) to 6 while on court. */
  position: number | null;
  kills: number;
  aces: number;
  blocks: number;
  pts: number;
}

export interface VolleyballTeam {
  id: string;
  side: 'home' | 'away';
  name: string;
  label: string;
  abbreviation: string | null;
  logoUrl: string | null;
  setsWon: number;
  /** Points in the current (or just-finished) set. */
  points: number;
  serving: boolean;
  serverPlayerId: string | null;
  /** Player ids in positions I–VI, or null when this set has no rotation for the team. */
  rotation: string[] | null;
  /** The coach's starting rotation, used when a set starts without an edit. */
  defaultRotation: string[] | null;
  timeoutsLeft: number;
  substitutionsLeft: number;
  oppErrorPoints: number;
  players: VolleyballPlayer[];
}

export interface VolleyballLogEntry {
  id: number;
  type: VolleyballPlayType;
  teamId: string;
  playerId: string | null;
  jersey: string | null;
  playerName: string | null;
  playerOutJersey: string | null;
  playerOutName: string | null;
  set: number;
  homeScore: number;
  awayScore: number;
}

export interface VolleyballScoreboard {
  sport: 'volleyball';
  eventId: string;
  eventName: string;
  category: string;
  version: number;
  ready: boolean;
  status: 'scheduled' | 'live' | 'finished';
  bestOf: number;
  setsToWin: number;
  bestOfLocked: boolean;
  rules: { setPoints: number; decidingSetPoints: number; timeoutsPerSet: number; substitutionsPerSet: number; bestOfOptions: number[] };
  currentSet: number;
  setInProgress: boolean;
  /** Points to win the current set. */
  target: number;
  matchDecided: boolean;
  winnerTeamId: string | null;
  nextSet: { number: number; target: number; suggestedServerTeamId: string | null } | null;
  playCount: number;
  teams: VolleyballTeam[];
  sets: {
    number: number;
    home: number;
    away: number;
    winnerTeamId: string | null;
    /** When the set's first serve was whistled ("Start set") and its last point scored. */
    startedAt: string | null;
    endedAt: string | null;
  }[];
  log: VolleyballLogEntry[];
  /** The server's clock when this scoreboard was built — the set clock runs from it. */
  serverTime?: string;
  updatedAt: string | null;
}
