// ─────────────────────────────────────────────────────────────────────────────
// SportAxisApp — Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'coach' | 'athlete' | 'judge';
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

// ── Event ────────────────────────────────────────────────────────────────────

/**
 * Matches the shape returned by GET /api/events and GET /api/events/{id}
 * (the EventController::toApiFormat() method).
 */
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
  judges: string[];
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
  judges: string[];
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

export interface OcrResult {
  total_score: number;
  confidence: number;
  image_url?: string | null;
  raw_text?: string;
  is_mock?: boolean;
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
