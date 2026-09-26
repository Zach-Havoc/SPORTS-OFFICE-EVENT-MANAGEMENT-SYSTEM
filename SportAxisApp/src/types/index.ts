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
